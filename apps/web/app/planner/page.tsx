"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  Building2,
  Briefcase,
  Loader2,
  CheckCircle2,
  MessageSquare,
  Code,
  Plus,
} from "lucide-react";
import type { PlanDay, PlanData } from "@/lib/plan-generator";

interface Plan {
  id: string;
  company: string;
  role: string;
  interviewDate: string;
  planData: PlanData;
  createdAt: string;
}

function PlanSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-3/4 animate-pulse rounded bg-muted" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 w-full animate-pulse rounded bg-muted" />
        ))}
      </div>
    </div>
  );
}

function DayCard({
  day,
  index,
  onToggle,
}: {
  day: PlanDay;
  index: number;
  onToggle: (index: number, completed: boolean) => void;
}) {
  const isBehavioral = day.focus === "behavioral";

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-4 transition-colors ${
        day.completed
          ? "bg-muted/50 border-muted"
          : "bg-background hover:bg-accent/30"
      }`}
    >
      <Checkbox
        checked={day.completed}
        onCheckedChange={(checked) => onToggle(index, !!checked)}
        className="mt-1"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">
            Day {index + 1} — {new Date(day.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </span>
          <Badge
            variant={isBehavioral ? "default" : "secondary"}
            className="text-xs"
          >
            {isBehavioral ? (
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                Behavioral
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Code className="h-3 w-3" />
                Technical
              </span>
            )}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {day.topics.map((topic, j) => (
            <span
              key={j}
              className="inline-block rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
            >
              {topic}
            </span>
          ))}
        </div>
      </div>
      {day.completed && (
        <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
      )}
    </div>
  );
}

export default function PlannerPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [interviewDate, setInterviewDate] = useState("");

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch("/api/plans");
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans);
        if (data.plans.length > 0) {
          setSelectedPlan((prev) => prev ?? data.plans[0]);
        }
      }
    } catch {
      // Silent failure — non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!company || !role || !interviewDate) return;

    setGenerating(true);
    try {
      const res = await fetch("/api/plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, role, interview_date: interviewDate }),
      });

      if (res.ok) {
        const plan = await res.json();
        setPlans((prev) => [plan, ...prev]);
        setSelectedPlan(plan);
        setShowForm(false);
        setCompany("");
        setRole("");
        setInterviewDate("");
      }
    } catch {
      // Error handling could be added
    } finally {
      setGenerating(false);
    }
  }

  async function handleToggleDay(dayIndex: number, completed: boolean) {
    if (!selectedPlan) return;

    // Optimistic update
    const updatedPlanData: PlanData = {
      ...selectedPlan.planData,
      days: selectedPlan.planData.days.map((day, i) =>
        i === dayIndex ? { ...day, completed } : day
      ),
    };
    const updatedPlan = { ...selectedPlan, planData: updatedPlanData };
    setSelectedPlan(updatedPlan);
    setPlans((prev) =>
      prev.map((p) => (p.id === updatedPlan.id ? updatedPlan : p))
    );

    try {
      await fetch(`/api/plans/${selectedPlan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day_index: dayIndex, completed }),
      });
    } catch {
      // Revert on failure
      setSelectedPlan(selectedPlan);
    }
  }

  const planData = selectedPlan?.planData;
  const days = planData?.days ?? [];
  const completedCount = days.filter((d) => d.completed).length;
  const progressPercent = days.length > 0 ? Math.round((completedCount / days.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Interview Prep Planner</h1>
          <p className="text-muted-foreground">
            Generate a personalized day-by-day preparation plan for your upcoming interview.
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} variant={showForm ? "outline" : "default"}>
          <Plus className="h-4 w-4 mr-2" />
          New Plan
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — Form + Plan list */}
        <div className="space-y-4">
          {showForm && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Create Plan</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleGenerate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="company">
                      <Building2 className="h-4 w-4 inline mr-1" />
                      Company
                    </Label>
                    <Input
                      id="company"
                      placeholder="e.g., Google"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">
                      <Briefcase className="h-4 w-4 inline mr-1" />
                      Role
                    </Label>
                    <Input
                      id="role"
                      placeholder="e.g., Senior Software Engineer"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="interview-date">
                      <CalendarDays className="h-4 w-4 inline mr-1" />
                      Interview Date
                    </Label>
                    <Input
                      id="interview-date"
                      type="date"
                      value={interviewDate}
                      onChange={(e) => setInterviewDate(e.target.value)}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={generating}
                  >
                    {generating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating Plan...
                      </>
                    ) : (
                      "Generate Plan"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Plans</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  <div className="h-12 w-full animate-pulse rounded bg-muted" />
                  <div className="h-12 w-full animate-pulse rounded bg-muted" />
                </div>
              ) : plans.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No plans yet. Create your first plan to get started.
                </p>
              ) : (
                <div className="space-y-2">
                  {plans.map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan)}
                      className={`w-full text-left rounded-lg border p-3 transition-colors ${
                        selectedPlan?.id === plan.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-accent/50"
                      }`}
                    >
                      <p className="font-medium text-sm">{plan.company}</p>
                      <p className="text-xs text-muted-foreground">{plan.role}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(plan.interviewDate).toLocaleDateString()}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column — Plan display */}
        <div className="lg:col-span-2">
          {loading ? (
            <Card>
              <CardContent className="pt-6">
                <PlanSkeleton />
              </CardContent>
            </Card>
          ) : selectedPlan ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>
                      {selectedPlan.company} — {selectedPlan.role}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Interview on{" "}
                      {new Date(selectedPlan.interviewDate).toLocaleDateString(
                        "en-US",
                        { weekday: "long", year: "numeric", month: "long", day: "numeric" }
                      )}
                    </p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>
                      {completedCount}/{days.length} days completed
                    </span>
                    <span className="text-muted-foreground">
                      {progressPercent}%
                    </span>
                  </div>
                  <Progress value={progressPercent} className="h-2" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {days.map((day, index) => (
                    <DayCard
                      key={index}
                      day={day}
                      index={index}
                      onToggle={handleToggleDay}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <CalendarDays className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Plan Selected</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Create a new plan by clicking &quot;New Plan&quot; and entering your interview details.
                  The AI will generate a personalized day-by-day preparation schedule.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
