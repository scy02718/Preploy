import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userResumes } from "@/lib/schema";
import { createRequestLogger } from "@/lib/logger";
import { parseResume } from "@/lib/resume-parser";
import OpenAI from "openai";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

async function extractTextFromPdfViaGPT(buffer: Buffer): Promise<string> {
  const openai = new OpenAI();
  // Convert PDF to base64 and send to GPT for text extraction
  const base64 = buffer.toString("base64");

  const response = await openai.chat.completions.create({
    model: "gpt-5.4-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a resume text extractor. Extract ALL text content from the provided PDF resume. " +
          "Preserve the structure (sections, bullet points, dates). " +
          "Return ONLY the extracted text, no commentary or formatting instructions.",
      },
      {
        role: "user",
        content: [
          {
            type: "file",
            file: {
              filename: "resume.pdf",
              file_data: `data:application/pdf;base64,${base64}`,
            },
          },
          {
            type: "text",
            text: "Extract all text from this resume PDF.",
          },
        ],
      },
    ],
    max_completion_tokens: 4000,
  });

  return response.choices[0]?.message?.content?.trim() ?? "";
}

// POST /api/resume/upload — upload a resume (PDF, TXT, MD) or paste content
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log = createRequestLogger({ route: "POST /api/resume/upload", userId: session.user.id });

  const contentType = request.headers.get("content-type") ?? "";

  let filename: string;
  let content: string;

  if (contentType.includes("application/json")) {
    // JSON body: { content: string, filename?: string } — for pasting resume text
    const body = await request.json();
    if (!body.content || typeof body.content !== "string") {
      return NextResponse.json({ error: "Resume content is required" }, { status: 400 });
    }
    content = body.content.trim();
    filename = body.filename ?? "pasted-resume.txt";
  } else {
    // Multipart form data: file upload
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }

    const file = formData.get("file") as File | null;
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }

    const fname = file.name.toLowerCase();
    const isPdf = fname.endsWith(".pdf") || file.type === "application/pdf";
    const isText = fname.endsWith(".txt") || fname.endsWith(".md") || file.type === "text/plain";

    if (!isPdf && !isText) {
      return NextResponse.json(
        { error: "Please upload a PDF, TXT, or MD file." },
        { status: 400 }
      );
    }

    try {
      if (isPdf) {
        const buffer = Buffer.from(await file.arrayBuffer());
        content = await extractTextFromPdfViaGPT(buffer);
      } else {
        content = (await file.text()).trim();
      }
    } catch (err) {
      log.error({ err }, "Failed to extract text from file");
      return NextResponse.json(
        { error: "Failed to extract text from file. Please try pasting the text instead." },
        { status: 422 }
      );
    }

    filename = file.name;
  }

  if (!content) {
    return NextResponse.json(
      { error: "Resume contains no extractable text" },
      { status: 400 }
    );
  }

  // Parse structured data — failure is non-fatal; we still store the resume
  let structuredData = null;
  try {
    structuredData = await parseResume(content);
  } catch (err) {
    log.warn({ err }, "parseResume threw unexpectedly; proceeding with structuredData: null");
  }

  const [resume] = await db
    .insert(userResumes)
    .values({
      userId: session.user.id,
      filename,
      content,
      structuredData,
    })
    .returning();

  log.info({ resumeId: resume.id, filename, hasStructuredData: structuredData !== null }, "Resume uploaded");

  return NextResponse.json(resume, { status: 201 });
}
