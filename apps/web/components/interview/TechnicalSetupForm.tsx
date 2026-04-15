"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useInterviewStore } from "@/stores/interviewStore";
import { TemplateControls } from "./TemplateControls";
import { ResumeSelector } from "./ResumeSelector";
import { UpgradePromptDialog } from "@/components/billing/UpgradePromptDialog";
import {
  SUPPORTED_LANGUAGES,
  FOCUS_AREAS_BY_TYPE,
} from "@interview-assistant/shared";
import type {
  TechnicalSessionConfig,
  TechnicalInterviewType,
  Difficulty,
} from "@interview-assistant/shared";

const INTERVIEW_TYPES: { value: TechnicalInterviewType; label: string }[] = [
  { value: "leetcode", label: "LeetCode-style" },
  { value: "system_design", label: "System Design" },
  { value: "frontend", label: "Frontend" },
  { value: "backend", label: "Backend" },
];

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

function formatFocusArea(area: string): string {
  return area
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function TechnicalSetupForm() {
  const router = useRouter();
  const { config, setConfig, setType, createSession } = useInterviewStore();
  const quotaError = useInterviewStore((s) => s.quotaError);
  const clearQuotaError = useInterviewStore((s) => s.clearQuotaError);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setType("technical");
  }, [setType]);

  const techConfig = config as TechnicalSessionConfig;

  const toggleFocusArea = (area: string) => {
    const current = techConfig.focus_areas ?? [];
    const updated = current.includes(area)
      ? current.filter((a) => a !== area)
      : [...current, area];
    setConfig({ focus_areas: updated });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!techConfig.focus_areas || techConfig.focus_areas.length === 0) {
      setError("Please select at least one focus area.");
      return;
    }

    setIsSubmitting(true);
    const sessionId = await createSession();
    setIsSubmitting(false);

    if (sessionId) {
      router.push("/interview/technical/session");
    } else {
      setError(
        useInterviewStore.getState().error || "Failed to create session"
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <TemplateControls
        type="technical"
        currentConfig={techConfig as unknown as Record<string, unknown>}
        onLoadTemplate={(config) => {
          setConfig(config as Record<string, unknown>);
        }}
      />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Left column — Interview Type + Focus Areas */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Interview Type</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={techConfig.interview_type ?? "leetcode"}
                onValueChange={(value) =>
                  setConfig({
                    interview_type: value as TechnicalInterviewType,
                    focus_areas: [],
                  })
                }
              >
                <div className="grid grid-cols-2 gap-3">
                  {INTERVIEW_TYPES.map(({ value, label }) => (
                    <label
                      key={value}
                      className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent has-[data-checked]:border-primary has-[data-checked]:bg-primary/5"
                    >
                      <RadioGroupItem value={value} />
                      {label}
                    </label>
                  ))}
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Focus Areas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Select the topics you want to practice. At least one is required.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {FOCUS_AREAS_BY_TYPE[techConfig.interview_type ?? "leetcode"].map((area) => {
                  const isChecked = (techConfig.focus_areas ?? []).includes(area);
                  return (
                    <label
                      key={area}
                      className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent has-[data-checked]:border-primary has-[data-checked]:bg-primary/5"
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleFocusArea(area)}
                      />
                      {formatFocusArea(area)}
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {(techConfig.focus_areas ?? []).length} selected
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right column — Resume + Language & Difficulty */}
        <div className="space-y-6">
          <ResumeSelector
            selectedResumeId={techConfig.resume_id ?? null}
            onSelect={(resumeId, resumeContent) => {
              setConfig({
                resume_id: resumeId ?? undefined,
                resume_text: resumeContent ?? undefined,
              });
            }}
          />

          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Programming Language</Label>
                <Select
                  value={techConfig.language ?? "python"}
                  onValueChange={(value) => {
                    if (value) setConfig({ language: value });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_LANGUAGES.map(({ id, label }) => (
                      <SelectItem key={id} value={id}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Difficulty</Label>
                <RadioGroup
                  value={techConfig.difficulty ?? "medium"}
                  onValueChange={(value) =>
                    setConfig({ difficulty: value as Difficulty })
                  }
                >
                  <div className="flex gap-3">
                    {DIFFICULTIES.map(({ value, label }) => (
                      <label
                        key={value}
                        className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent has-[data-checked]:border-primary has-[data-checked]:bg-primary/5"
                      >
                        <RadioGroupItem value={value} />
                        {label}
                      </label>
                    ))}
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Additional Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Optionally provide extra context for problem generation.
              </p>
              <Textarea
                placeholder="e.g., Focus on Google-style problems, avoid recursion, emphasize graph algorithms..."
                value={techConfig.additional_instructions ?? ""}
                onChange={(e) =>
                  setConfig({ additional_instructions: e.target.value })
                }
                maxLength={1000}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                {(techConfig.additional_instructions ?? "").length}/1000
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Submit */}
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={
          isSubmitting || (techConfig.focus_areas ?? []).length === 0
        }
      >
        {isSubmitting ? "Creating Session..." : "Start Interview"}
      </Button>

      {quotaError && (
        <UpgradePromptDialog
          open={true}
          onClose={clearQuotaError}
          used={quotaError.used}
          limit={quotaError.limit}
        />
      )}
    </form>
  );
}
