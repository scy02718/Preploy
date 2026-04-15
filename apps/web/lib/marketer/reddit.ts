/**
 * Reddit public JSON API fetcher for the marketer cron job.
 * Uses the public (no-auth) .json endpoint with a real User-Agent.
 * Handles rate limiting with a single retry after 5 s.
 */

import type pino from "pino";

export interface RedditPost {
  id: string;
  subreddit: string;
  title: string;
  selftext: string;
  permalink: string;
  created_utc: number; // Unix seconds
}

interface RedditApiChild {
  kind: string;
  data: {
    id: string;
    subreddit: string;
    title: string;
    selftext: string;
    permalink: string;
    created_utc: number;
    is_self: boolean;
  };
}

interface RedditApiResponse {
  data: {
    children: RedditApiChild[];
  };
}

const USER_AGENT = "Preploy/0.1 (interview prep helper)";
const DEFAULT_FRESHNESS_HOURS = 48;

function getFreshnessHours(): number {
  const raw = process.env.MARKETER_FRESHNESS_HOURS;
  if (!raw) return DEFAULT_FRESHNESS_HOURS;
  const parsed = parseInt(raw, 10);
  return isNaN(parsed) || parsed <= 0 ? DEFAULT_FRESHNESS_HOURS : parsed;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  return fetch(url, {
    signal: AbortSignal.timeout(10_000),
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  });
}

/**
 * Fetch the latest posts from a subreddit via the Reddit public JSON API.
 * Filters out posts older than MARKETER_FRESHNESS_HOURS (default 48h).
 * Retries once on 429 after 5 s; logs and returns [] on persistent failure.
 */
export async function fetchSubredditPosts(
  sub: string,
  limit: number,
  log: pino.Logger
): Promise<RedditPost[]> {
  const url = `https://www.reddit.com/r/${sub}/new.json?limit=${limit}`;
  const freshnessMs = getFreshnessHours() * 60 * 60 * 1000;
  const cutoff = Date.now() - freshnessMs;

  let res: Response;

  try {
    res = await fetchWithTimeout(url);
  } catch (err) {
    log.error({ err, sub }, "reddit fetch failed (network/timeout)");
    return [];
  }

  if (res.status === 429) {
    log.warn({ sub }, "reddit 429, retrying after 5s");
    await new Promise((r) => setTimeout(r, 5_000));
    try {
      res = await fetchWithTimeout(url);
    } catch (err) {
      log.error({ err, sub }, "reddit fetch failed after 429 retry");
      return [];
    }
    if (res.status === 429) {
      log.error({ sub }, "reddit still rate-limited after retry, skipping");
      return [];
    }
  }

  if (!res.ok) {
    log.error({ sub, status: res.status }, "reddit fetch non-OK status");
    return [];
  }

  let json: RedditApiResponse;
  try {
    json = (await res.json()) as RedditApiResponse;
  } catch (err) {
    log.error({ err, sub }, "reddit response JSON parse failed");
    return [];
  }

  const children = json?.data?.children ?? [];

  return children
    .filter(
      (c) =>
        c.kind === "t3" &&
        c.data.is_self &&
        c.data.created_utc * 1000 >= cutoff
    )
    .map((c) => ({
      id: c.data.id,
      subreddit: c.data.subreddit,
      title: c.data.title,
      selftext: c.data.selftext,
      permalink: c.data.permalink,
      created_utc: c.data.created_utc,
    }));
}
