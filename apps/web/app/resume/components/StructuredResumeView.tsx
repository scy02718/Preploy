"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import type { StructuredResume } from "@/lib/resume-parser";

interface StructuredResumeViewProps {
  structuredData: StructuredResume;
  /** resumeId reserved for future use (deep-link, analytics) */
  resumeId?: string;
  onImprove: (bullet: string, roleTitle: string, roleCompany: string) => void;
  improvingBullet: string | null; // bullet text currently in-flight
}

/** Returns Tailwind class based on impact band. */
function getImpactClass(score: number): string {
  if (score >= 8) return "text-[color:var(--primary)]";
  if (score >= 6) return "text-[color:var(--chart-2)]";
  return "text-destructive";
}

export function StructuredResumeView({
  structuredData,
  onImprove,
  improvingBullet,
}: StructuredResumeViewProps) {
  const [selectedRoleIndex, setSelectedRoleIndex] = useState(0);

  const selectedRole = structuredData.roles[selectedRoleIndex] ?? null;

  if (structuredData.roles.length === 0 && structuredData.skills.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        No structured data was extracted from this resume.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {structuredData.roles.length > 0 ? (
        <>
          {/* Two-pane layout: role list left, detail right */}
          <div className="flex flex-col gap-4 md:grid md:grid-cols-[200px_1fr]">
            {/* Roles list */}
            <nav
              aria-label="Resume roles"
              className="flex flex-row gap-1 overflow-x-auto md:flex-col md:overflow-x-visible"
            >
              {structuredData.roles.map((role, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedRoleIndex(idx)}
                  className={`rounded-md px-3 py-2 text-left text-sm transition-colors min-w-[140px] md:min-w-0 ${
                    selectedRoleIndex === idx
                      ? "bg-primary/10 font-medium text-[color:var(--primary)]"
                      : "hover:bg-accent text-muted-foreground"
                  }`}
                  aria-pressed={selectedRoleIndex === idx}
                >
                  <span className="block font-medium truncate">{role.company}</span>
                  <span className="block text-xs truncate">{role.title}</span>
                </button>
              ))}
            </nav>

            {/* Role detail */}
            {selectedRole && (
              <div className="space-y-3">
                <div>
                  <p className="font-semibold text-base">{selectedRole.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedRole.company}
                    {selectedRole.dates ? ` · ${selectedRole.dates}` : ""}
                  </p>
                </div>

                {selectedRole.bullets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No bullets extracted for this role.</p>
                ) : (
                  <ul className="space-y-3">
                    {selectedRole.bullets.map((bullet, bIdx) => {
                      const isWeak = bullet.impact_score < 6;
                      const isImproving = improvingBullet === bullet.text;
                      return (
                        <li key={bIdx} className="flex flex-col gap-1.5 rounded-md border p-3">
                          <p className="text-sm">{bullet.text}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Impact chip */}
                            <Badge
                              variant="outline"
                              className={`text-xs font-medium ${getImpactClass(bullet.impact_score)}`}
                            >
                              Impact {bullet.impact_score}/10
                            </Badge>

                            {/* Quantified metric pill */}
                            {bullet.has_quantified_metric && (
                              <Badge variant="secondary" className="text-xs">
                                Quantified
                              </Badge>
                            )}

                            {/* Improve button for weak bullets */}
                            {isWeak && (
                              <Button
                                variant="outline"
                                size="sm"
                                aria-label="Rewrite bullet with AI"
                                aria-disabled={isImproving}
                                disabled={isImproving}
                                onClick={() =>
                                  onImprove(bullet.text, selectedRole.title, selectedRole.company)
                                }
                                className="h-8 gap-1.5 motion-safe:transition-opacity"
                              >
                                <Sparkles
                                  className="h-4 w-4 text-[color:var(--primary)]"
                                  aria-hidden="true"
                                />
                                {isImproving ? "Improving..." : "Improve"}
                              </Button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No roles were extracted from this resume.</p>
      )}

      {/* Skills section */}
      {structuredData.skills.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Skills</p>
          <div className="flex flex-wrap gap-1.5">
            {structuredData.skills.map((skill, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {skill}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
