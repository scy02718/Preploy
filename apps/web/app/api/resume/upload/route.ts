import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userResumes } from "@/lib/schema";
import { createRequestLogger } from "@/lib/logger";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // Dynamic import to avoid loading pdf-parse at module level
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

// POST /api/resume/upload — upload a PDF or text resume
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log = createRequestLogger({ route: "POST /api/resume/upload", userId: session.user.id });

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

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 5MB." },
      { status: 400 }
    );
  }

  // Validate file type
  const filename = file.name.toLowerCase();
  const isPdf = filename.endsWith(".pdf") || file.type === "application/pdf";
  const isText = filename.endsWith(".txt") || file.type === "text/plain";

  if (!isPdf && !isText) {
    return NextResponse.json(
      { error: "Invalid file type. Only PDF and text files are accepted." },
      { status: 400 }
    );
  }

  let content: string;

  try {
    if (isPdf) {
      const arrayBuffer = await file.arrayBuffer();
      content = await extractTextFromPdf(Buffer.from(arrayBuffer));
    } else {
      content = await file.text();
    }
  } catch (err) {
    log.error({ err }, "Failed to extract text from file");
    return NextResponse.json(
      { error: "Failed to extract text from file" },
      { status: 422 }
    );
  }

  if (!content.trim()) {
    return NextResponse.json(
      { error: "File contains no extractable text" },
      { status: 400 }
    );
  }

  const [resume] = await db
    .insert(userResumes)
    .values({
      userId: session.user.id,
      filename: file.name,
      content: content.trim(),
    })
    .returning();

  log.info({ resumeId: resume.id, filename: file.name }, "Resume uploaded");

  return NextResponse.json(resume, { status: 201 });
}
