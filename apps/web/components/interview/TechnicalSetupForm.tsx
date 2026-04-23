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
import { usePrefillStore } from "@/stores/prefillStore";
import { TemplateControls } from "./TemplateControls";
import { ResumeSelector } from "./ResumeSelector";
import { UpgradePromptDialog } from "@/components/billing/UpgradePromptDialog";
import { ProAnalysisToggle } from "./ProAnalysisToggle";
import { FocusDirectiveField } from "./FocusDirectiveField";
import {
  SUPPORTED_LANGUAGES,
  FOCUS_AREAS_BY_TYPE,
} from "@preploy/shared";
import type {
  TechnicalSessionConfig,
  TechnicalInterviewType,
  Difficulty,
} from "@preploy/shared";

/** Prefix used to embed the user's Other topic inside additional_instructions. */
const OTHER_PREFIX = "Other focus area: ";

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
  if (area === "other") return "Other";
  return area
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Strip any existing Other-prefix segment from an additional_instructions string. */
function stripOtherSegment(instructions: string): string {
  return instructions
    .split("\n\n")
    .filter((seg) => !seg.startsWith(OTHER_PREFIX))
    .join("\n\n")
    .trim();
}

export function TechnicalSetupForm() {
  const router = useRouter();
  const { config, setConfig, setType, createSession } = useInterviewStore();
  const quotaError = useInterviewStore((s) => s.quotaError);
  const clearQuotaError = useInterviewStore((s) => s.clearQuotaError);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useProAnalysis, setUseProAnalysis] = useState(false);

  const { technicalPrefill, clearPrefill } = usePrefillStore();

  const techConfig = config as TechnicalSessionConfig;

  // Derive Other focus-area state from the store directly (no local useState
  // needed — avoids violating react-hooks/set-state-in-effect).
  const otherChecked = (techConfig.focus_areas ?? []).includes("other");
  const otherText = (() => {
    const instructions = techConfig.additional_instructions ?? "";
    const segment = instructions
      .split("\n\n")
      .find((seg) => seg.startsWith(OTHER_PREFIX));
    return segment ? segment.slice(OTHER_PREFIX.length) : "";
  })();

  // Set the interview type on mount. `setType` resets config to defaults,
  // so this effect MUST NOT depend on `technicalPrefill` — otherwise
  // clearing the prefill triggers a re-run that wipes the just-applied
  // values.
  useEffect(() => {
    setType("technical");
  }, [setType]);

  // Apply prefill from other pages (resume, planner, etc.). Runs after
  // setType and clears the prefill so the next visit starts fresh.
  useEffect(() => {
    if (!technicalPrefill) return;
    if (technicalPrefill.interview_type) {
      setConfig({ interview_type: technicalPrefill.interview_type, focus_areas: [] });
    }
    if (technicalPrefill.focus_areas?.length) {
      setConfig({ focus_areas: technicalPrefill.focus_areas });
    }
    if (technicalPrefill.additional_instructions) {
      setConfig({ additional_instructions: technicalPrefill.additional_instructions });
    }
    if (technicalPrefill.resume_id) {
      setConfig({ resume_id: technicalPrefill.resume_id });
    }
    clearPrefill();
  }, [technicalPrefill, clearPrefill, setConfig]);

  const toggleFocusArea = (area: string) => {
    if (area === "other") {
      const current = techConfig.focus_areas ?? [];
      if (current.includes("other")) {
        // Uncheck: remove sentinel, strip segment from instructions
        const newAreas = current.filter((a) => a !== "other");
        const baseInstructions = stripOtherSegment(
          techConfig.additional_instructions ?? ""
        );
        setConfig({
          focus_areas: newAreas,
          additional_instructions: baseInstructions || undefined,
        });
      } else {
        // Check: add sentinel only (text is still empty — no segment injected yet)
        setConfig({ focus_areas: [...current, "other"] });
      }
      return;
    }

    const current = techConfig.focus_areas ?? [];
    const updated = current.includes(area)
      ? current.filter((a) => a !== area)
      : [...current, area];
    setConfig({ focus_areas: updated });
  };

  const handleOtherTextChange = (text: string) => {
    const baseInstructions = stripOtherSegment(
      techConfig.additional_instructions ?? ""
    );
    const otherSegment = text.trim() ? OTHER_PREFIX + text.trim() : "";
    const merged = [baseInstructions, otherSegment].filter(Boolean).join("\n\n");
    setConfig({ additional_instructions: merged || undefined });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!techConfig.focus_areas || techConfig.focus_areas.length === 0) {
      setError("Please select at least one focus area.");
      return;
    }

    setIsSubmitting(true);
    const sessionId = await createSession({ use_pro_analysis: useProAnalysis });
    setIsSubmitting(false);

    if (sessionId) {
      router.push("/interview/technical/session");
    } else {
      setError(
        useInterviewStore.getState().error || "Failed to create session"
      );
    }
  };

  // Submit is disabled when Other is checked but no topic is typed
  const isOtherInvalid = otherChecked && !otherText.trim();
  const noFocusAreas = (techConfig.focus_areas ?? []).length === 0;

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
              {otherChecked && (
                <div className="space-y-1 pt-1">
                  <Textarea
                    rows={2}
                    maxLength={200}
                    placeholder="Specify a topic…"
                    value={otherText}
                    onChange={(e) => handleOtherTextChange(e.target.value)}
                    aria-label="Other focus area description"
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {otherText.length}/200
                  </p>
                </div>
              )}
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
              <FocusDirectiveField
                value={techConfig.focus_directive ?? ""}
                onChange={(v) => setConfig({ focus_directive: v || undefined })}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Pro analysis toggle */}
      <ProAnalysisToggle value={useProAnalysis} onChange={setUseProAnalysis} />

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
        disabled={isSubmitting || noFocusAreas || isOtherInvalid}
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
