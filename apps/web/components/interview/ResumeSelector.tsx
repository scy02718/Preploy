"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText } from "lucide-react";
import Link from "next/link";

interface Resume {
  id: string;
  filename: string;
  content: string;
  createdAt: string;
}

interface ResumeSelectorProps {
  selectedResumeId: string | null;
  onSelect: (resumeId: string | null, resumeContent: string | null) => void;
}

export function ResumeSelector({ selectedResumeId, onSelect }: ResumeSelectorProps) {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchResumes() {
      try {
        const res = await fetch("/api/resume");
        if (res.ok) setResumes(await res.json());
      } catch {
        // Silent
      } finally {
        setIsLoading(false);
      }
    }
    fetchResumes();
  }, []);

  const selectedResume = resumes.find((r) => r.id === selectedResumeId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Resume</CardTitle></CardHeader>
        <CardContent>
          <div className="h-8 w-full animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" />
          Include Resume
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {resumes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No resumes uploaded.{" "}
            <Link href="/resume" className="text-primary hover:underline">
              Upload one
            </Link>{" "}
            to get personalized questions.
          </p>
        ) : (
          <>
            <Select
              value={selectedResumeId ?? "none"}
              onValueChange={(v) => {
                const value = String(v);
                if (value === "none") {
                  onSelect(null, null);
                } else {
                  const resume = resumes.find((r) => r.id === value);
                  onSelect(value, resume?.content ?? null);
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a resume..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {resumes.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.filename}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedResume && (
              <p className="text-xs text-muted-foreground line-clamp-3">
                {selectedResume.content.slice(0, 200)}...
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              The AI will reference your resume during the interview.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
