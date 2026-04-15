import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { marketerPosts, marketerDrafts } from "@/lib/schema";
import { createRequestLogger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/api-utils";
import { fetchSubredditPosts } from "@/lib/marketer/reddit";
import { buildClassifierPrompt } from "@/lib/marketer-classifier-prompt";
import {
  buildPrepareReplyPrompt,
  buildCheatReplyPrompt,
} from "@/lib/marketer-reply-prompt";
import { classificationResultSchema } from "@/lib/validations";
import { OpenAIRetryError, withOpenAIRetry } from "@/lib/openai-retry";
import OpenAI from "openai";

const SUBREDDITS = ["cscareerquestions", "leetcode", "interviews"];
const POSTS_PER_SUB = 25;

// POST /api/admin/marketer/run — cron endpoint (authorized via CRON_SECRET)
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Paranoia rate-limit check against misconfigured schedule (use cron job ID as key)
  const rateLimitResult = checkRateLimit("cron-marketer-run");
  if (rateLimitResult) return rateLimitResult;

  const log = createRequestLogger({
    route: "POST /api/admin/marketer/run",
    userId: "cron",
  });

  log.info("marketer cron run starting");

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let totalFetched = 0;
  let totalInserted = 0;
  let totalDrafted = 0;
  const errors: string[] = [];

  for (const sub of SUBREDDITS) {
    log.info({ sub }, "fetching subreddit");

    let posts;
    try {
      posts = await fetchSubredditPosts(sub, POSTS_PER_SUB, log);
    } catch (err) {
      log.error({ err, sub }, "failed to fetch subreddit");
      errors.push(`fetch:${sub}`);
      continue;
    }

    totalFetched += posts.length;
    log.info({ sub, count: posts.length }, "fetched posts");

    for (const post of posts) {
      // Classify the post
      let classification: "prepare" | "cheat" | "irrelevant";
      let summary: string;

      try {
        const classifierPrompt = buildClassifierPrompt({
          title: post.title,
          body: post.selftext,
          subreddit: post.subreddit,
        });

        const result = await withOpenAIRetry(
          () =>
            openai.chat.completions.create({
              model: "gpt-5.4-mini",
              messages: [{ role: "user", content: classifierPrompt }],
              response_format: { type: "json_object" },
              temperature: 0.1,
              max_completion_tokens: 200,
            }),
          (raw) => {
            let json: unknown;
            try {
              json = JSON.parse(raw);
            } catch (e) {
              throw new OpenAIRetryError("invalid_json", e);
            }
            const validated = classificationResultSchema.safeParse(json);
            if (!validated.success) {
              throw new OpenAIRetryError("schema_mismatch", validated.error);
            }
            return validated.data;
          },
          { service: "marketer-classifier", log }
        );

        classification = result.classification;
        summary = result.summary;
      } catch (err) {
        log.error({ err, postId: post.id }, "classification failed, skipping");
        errors.push(`classify:${post.id}`);
        continue;
      }

      // Insert the post (ON CONFLICT DO NOTHING for idempotency)
      let insertedPost: typeof marketerPosts.$inferSelect | null = null;
      try {
        const [row] = await db
          .insert(marketerPosts)
          .values({
            source: "reddit",
            externalId: post.id,
            subreddit: post.subreddit,
            title: post.title,
            body: post.selftext,
            permalink: `https://reddit.com${post.permalink}`,
            postedAt: new Date(post.created_utc * 1000),
            classification,
            summary,
          })
          .onConflictDoNothing()
          .returning();

        if (row) {
          insertedPost = row;
          totalInserted++;
        }
        // If row is undefined, this post was already processed — skip drafting
      } catch (err) {
        log.error({ err, postId: post.id }, "failed to insert marketer post");
        errors.push(`insert:${post.id}`);
        continue;
      }

      // Only draft for newly inserted posts with actionable intent
      if (!insertedPost || classification === "irrelevant") {
        continue;
      }

      // Generate reply draft
      let reply: string;
      try {
        const replyPrompt =
          classification === "prepare"
            ? buildPrepareReplyPrompt({
                post: {
                  title: post.title,
                  selftext: post.selftext,
                  subreddit: post.subreddit,
                  permalink: post.permalink,
                },
                summary,
              })
            : buildCheatReplyPrompt({
                post: {
                  title: post.title,
                  selftext: post.selftext,
                  subreddit: post.subreddit,
                  permalink: post.permalink,
                },
                summary,
              });

        const replyResponse = await openai.chat.completions.create({
          model: "gpt-5.4-mini",
          messages: [{ role: "user", content: replyPrompt }],
          temperature: 0.8,
          max_completion_tokens: 400,
        });

        reply = replyResponse.choices[0]?.message?.content ?? "";
        if (!reply) {
          log.warn({ postId: post.id }, "empty reply generated, skipping");
          errors.push(`reply:${post.id}`);
          continue;
        }
      } catch (err) {
        log.error({ err, postId: post.id }, "reply generation failed");
        errors.push(`reply:${post.id}`);
        continue;
      }

      // Insert the draft
      try {
        await db.insert(marketerDrafts).values({
          postId: insertedPost.id,
          intent: classification,
          reply,
          status: "pending",
        });
        totalDrafted++;
      } catch (err) {
        log.error({ err, postId: post.id }, "failed to insert draft");
        errors.push(`draft:${post.id}`);
      }
    }
  }

  log.info(
    { totalFetched, totalInserted, totalDrafted, errors: errors.length },
    "marketer cron run complete"
  );

  return NextResponse.json({
    totalFetched,
    totalInserted,
    totalDrafted,
    errors,
  });
}
