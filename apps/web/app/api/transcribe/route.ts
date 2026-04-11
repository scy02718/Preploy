import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { interviewSessions } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import OpenAI from "openai";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB — OpenAI's limit

// POST /api/transcribe — transcribe audio using gpt-4o-mini-transcribe
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

    const transcription = await openai.audio.transcriptions.create({
      model: "gpt-4o-mini-transcribe",
      file: audioFile,
      response_format: "json",
    });

    const text = transcription.text?.trim() ?? "";

    // gpt-4o-mini-transcribe with "json" format returns { text } only (no word timestamps).
    // Build a single transcript entry from the full text.
    const entries = text.length > 0
      ? [{ speaker: "user" as const, text, timestamp_ms: 0 }]
      : [];

    return NextResponse.json({ entries });
  } catch (err) {
    console.error("Transcription error:", err);
    return NextResponse.json(
      { error: "Transcription failed" },
      { status: 500 }
    );
  }
}
