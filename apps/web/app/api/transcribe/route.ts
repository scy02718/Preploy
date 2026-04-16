import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { interviewSessions } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import OpenAI from "openai";
import { groupWordsIntoSegments } from "@/lib/transcription";
import { createRequestLogger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/api-utils";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB — OpenAI's limit

// POST /api/transcribe — transcribe audio using whisper-1
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimited = await checkRateLimit(session.user.id);
  if (rateLimited) return rateLimited;

  const formData = await request.formData();
  const audioFile = formData.get("audio");
  const sessionId = formData.get("session_id");

  if (!audioFile || !(audioFile instanceof File)) {
    return NextResponse.json(
      { error: "Missing audio file" },
      { status: 400 }
    );
  }

  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json(
      { error: "Missing session_id" },
      { status: 400 }
    );
  }

  if (audioFile.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "Audio file too large (max 25MB)" },
      { status: 400 }
    );
  }

  // Verify session ownership
  const [found] = await db
    .select()
    .from(interviewSessions)
    .where(
      and(
        eq(interviewSessions.id, sessionId),
        eq(interviewSessions.userId, session.user.id)
      )
    );

  if (!found) {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenAI API key not configured" },
      { status: 500 }
    );
  }

  try {
    const openai = new OpenAI({ apiKey });

    // Use whisper-1 which supports verbose_json + word-level timestamps.
    // gpt-4o-mini-transcribe only supports "json"/"text" (no word timestamps).
    const transcription = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file: audioFile,
      response_format: "verbose_json",
      timestamp_granularities: ["word"],
    });

    const words =
      (transcription as unknown as { words?: { word: string; start: number; end: number }[] }).words ?? [];

    // Group words into segments split on >1s pauses for a natural timeline
    const entries = groupWordsIntoSegments(words);

    // Fallback: if whisper returned text but no words array, use the full text
    if (entries.length === 0 && transcription.text?.trim()) {
      entries.push({ speaker: "user", text: transcription.text.trim(), timestamp_ms: 0 });
    }

    return NextResponse.json({ entries });
  } catch (err) {
    const log = createRequestLogger({ route: "POST /api/transcribe", sessionId });
    log.error({ err }, "Transcription failed");
    return NextResponse.json(
      { error: "Transcription failed" },
      { status: 500 }
    );
  }
}
