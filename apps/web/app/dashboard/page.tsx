"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getScoreColor } from "@/lib/utils";
import { ChevronLeft, ChevronRight, MessageSquare, Code } from "lucide-react";
import { StreakCard } from "@/components/dashboard/StreakCard";
import { BadgeGrid } from "@/components/dashboard/BadgeGrid";
import { ScoreTrendChart, ScoreTrendPoint } from "@/components/dashboard/ScoreTrendChart";
import { WeakAreas, WeakArea } from "@/components/dashboard/WeakAreas";
import { MonthlyUsageMeter } from "@/components/dashboard/MonthlyUsageMeter";

const ONBOARDING_DISMISSED_KEY = "preploy_onboarding_dismissed";

interface SessionRow {
  id: string;
  type: "behavioral" | "technical";
  status: string;
  config: Record<string, unknown>;
  createdAt: string;
  durationSeconds?: number | null;
  overallScore?: number | null;
}

interface PaginationMeta {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

const PAGE_SIZE = 10;

function getSessionLabel(session: SessionRow): string {
  const config = session.config;
  if (session.type === "technical") {
    const interviewType = config?.interview_type as string | undefined;
    if (interviewType) {
      return interviewType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return "Technical Interview";
  }
  const company = config?.company_name as string | undefined;
  if (company) return company;
  return "Behavioral Interview";
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export default function DashboardPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Onboarding: show a welcome card when the user has zero sessions and
  // hasn't dismissed it yet.
  const [onboardingDismissed, setOnboardingDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(ONBOARDING_DISMISSED_KEY) === "1";
  });

  // Filters
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [scoreFilter, setScoreFilter] = useState<string>("all");

  // Stats (fetched once with no filters)
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [totalSessions, setTotalSessions] = useState(0);
  const [avgScore, setAvgScore] = useState<number | null>(null);
  const [thisWeek, setThisWeek] = useState(0);
  const [quota, setQuota] = useState<{
    plan: string;
    planName: string;
    used: number;
    limit: number;
    remaining: number;
  } | null>(null);
  const [userStats, setUserStats] = useState<{
    currentStreak: number;
    longestStreak: number;
    heatmap: { date: string; count: number }[];
    badges: { badgeId: string; earnedAt: string }[];
  } | null>(null);
  const [progress, setProgress] = useState<{
    scoreTrend: ScoreTrendPoint[];
    weakAreas: WeakArea[];
    monthComparison: {
      thisMonth: { sessions: number; avgScore: number | null };
      lastMonth: { sessions: number; avgScore: number | null };
    };
  } | null>(null);

  // Fetch stats + quota once on mount
  useEffect(() => {
    async function fetchStats() {
      try {
        // Fetch quota + user stats + progress in parallel
        const [quotaRes, statsRes, progressRes] = await Promise.all([
          fetch("/api/sessions/quota"),
          fetch("/api/users/stats"),
          fetch("/api/users/progress"),
        ]);
        if (quotaRes.ok) {
          setQuota(await quotaRes.json());
        }
        if (statsRes.ok) {
          setUserStats(await statsRes.json());
        }
        if (progressRes.ok) {
          setProgress(await progressRes.json());
        }

        const res = await fetch("/api/sessions?limit=50&page=1");
        if (!res.ok) return;
        const data = await res.json();
        const allSessions: SessionRow[] = data.sessions;
        const total = data.pagination.totalCount;
        setTotalSessions(total);

        const scores = allSessions
          .map((s) => s.overallScore)
          .filter((s): s is number => s !== null && s !== undefined);
        setAvgScore(
          scores.length > 0
            ? scores.reduce((a, b) => a + b, 0) / scores.length
            : null
        );

        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        setThisWeek(
          allSessions.filter((s) => new Date(s.createdAt) >= oneWeekAgo).length
        );
      } catch {
        // Silent
      } finally {
        setIsStatsLoading(false);
      }
    }
    fetchStats();
  }, []);

  // Fetch paginated + filtered sessions
  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (typeFilter !== "all") {
        params.set("type", typeFilter);
      }
      if (scoreFilter === "high") {
        params.set("minScore", "7");
      } else if (scoreFilter === "mid") {
        params.set("minScore", "4");
        params.set("maxScore", "6.99");
      } else if (scoreFilter === "low") {
        params.set("maxScore", "3.99");
      }

      const res = await fetch(`/api/sessions?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setSessions(data.sessions);
      setPagination(data.pagination);
    } catch {
      // Silent
    } finally {
      setIsLoading(false);
    }
  }, [page, typeFilter, scoreFilter]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Reset to page 1 when filters change
  function handleTypeChange(value: string) {
    setTypeFilter(value);
    setPage(1);
  }
  function handleScoreChange(value: string) {
    setScoreFilter(value);
    setPage(1);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <p className="text-muted-foreground mb-8">
        View your interview history and track your progress.
      </p>

      {/* Free-tier monthly usage meter (renders nothing for Pro users). */}
      <div className="mb-6">
        <MonthlyUsageMeter />
      </div>

      {/* Welcome card for first-time users OR stats grid for returning users */}
      {!isStatsLoading && totalSessions === 0 && !onboardingDismissed ? (
        <Card className="mb-8" data-testid="welcome-card">
          <CardContent className="py-10 text-center space-y-6">
            <div>
              <h2 className="text-2xl font-bold" data-testid="welcome-heading">
                Welcome to Preploy
              </h2>
              <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                Let&apos;s run your first mock interview — it takes about 5 minutes.
                Pick behavioral or technical to get started.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/interview/behavioral/setup">
                <Button size="lg" className="min-w-52 gap-2" data-testid="cta-behavioral">
                  <MessageSquare className="h-5 w-5" />
                  Start Behavioral Interview
                </Button>
              </Link>
              <Link href="/interview/technical/setup">
                <Button size="lg" variant="outline" className="min-w-52 gap-2" data-testid="cta-technical">
                  <Code className="h-5 w-5" />
                  Start Technical Interview
                </Button>
              </Link>
            </div>
            <button
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              data-testid="dismiss-onboarding"
              onClick={() => {
                localStorage.setItem(ONBOARDING_DISMISSED_KEY, "1");
                setOnboardingDismissed(true);
              }}
            >
              or, explore the dashboard →
            </button>
          </CardContent>
        </Card>
      ) : isStatsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="space-y-2">
                <div className="h-9 w-16 animate-pulse rounded bg-muted" />
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">{totalSessions}</CardTitle>
              <CardDescription>Total Sessions</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">
                {avgScore !== null ? avgScore.toFixed(1) : "--"}
              </CardTitle>
              <CardDescription>Average Score</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">{thisWeek}</CardTitle>
              <CardDescription>This Week</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">
                {quota ? `${quota.remaining}/${quota.limit}` : "--"}
              </CardTitle>
              <CardDescription>
                Sessions Today
                {quota && (
                  <span className="ml-1 text-xs">({quota.planName} plan)</span>
                )}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Streak + Badges row */}
      {userStats ? (
        <div className="grid grid-cols-1 gap-4 mb-8 md:grid-cols-2">
          <StreakCard
            currentStreak={userStats.currentStreak}
            longestStreak={userStats.longestStreak}
            heatmap={userStats.heatmap}
          />
          <BadgeGrid earnedBadges={userStats.badges} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 mb-8 md:grid-cols-2">
          {/* Streak skeleton */}
          <Card>
            <CardHeader className="pb-3">
              <div className="h-5 w-32 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-6">
                <div className="space-y-1">
                  <div className="h-8 w-12 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                </div>
                <div className="space-y-1">
                  <div className="h-8 w-12 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                </div>
              </div>
              <div className="flex gap-0.5 flex-wrap">
                {Array.from({ length: 30 }).map((_, i) => (
                  <div key={i} className="h-4 w-4 animate-pulse rounded-sm bg-muted" />
                ))}
              </div>
            </CardContent>
          </Card>
          {/* Badges skeleton */}
          <Card>
            <CardHeader className="pb-3">
              <div className="h-5 w-28 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center gap-1 rounded-lg border p-3">
                    <div className="h-8 w-8 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                    <div className="h-2 w-20 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Progress section */}
      {progress ? (
        <div className="mb-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Progress</h2>
            <Link href="/dashboard/compare">
              <Button variant="outline" size="sm">
                Compare Sessions
              </Button>
            </Link>
          </div>

          {/* Month comparison banner */}
          {(progress.monthComparison.thisMonth.avgScore != null ||
            progress.monthComparison.lastMonth.avgScore != null) && (
            <Card>
              <CardContent className="flex flex-wrap items-center gap-4 py-3 text-sm">
                <span className="text-muted-foreground">This month:</span>
                <span className="font-medium">
                  {progress.monthComparison.thisMonth.sessions} sessions
                  {progress.monthComparison.thisMonth.avgScore != null &&
                    `, avg ${progress.monthComparison.thisMonth.avgScore}`}
                </span>
                <span className="text-muted-foreground">|</span>
                <span className="text-muted-foreground">Last month:</span>
                <span className="font-medium">
                  {progress.monthComparison.lastMonth.sessions} sessions
                  {progress.monthComparison.lastMonth.avgScore != null &&
                    `, avg ${progress.monthComparison.lastMonth.avgScore}`}
                </span>
                {progress.monthComparison.thisMonth.avgScore != null &&
                  progress.monthComparison.lastMonth.avgScore != null && (
                    <Badge
                      variant={
                        progress.monthComparison.thisMonth.avgScore >
                        progress.monthComparison.lastMonth.avgScore
                          ? "default"
                          : progress.monthComparison.thisMonth.avgScore <
                              progress.monthComparison.lastMonth.avgScore
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {progress.monthComparison.thisMonth.avgScore >
                      progress.monthComparison.lastMonth.avgScore
                        ? "+"
                        : ""}
                      {(
                        progress.monthComparison.thisMonth.avgScore -
                        progress.monthComparison.lastMonth.avgScore
                      ).toFixed(1)}
                    </Badge>
                  )}
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ScoreTrendChart data={progress.scoreTrend} />
            <WeakAreas areas={progress.weakAreas} />
          </div>
        </div>
      ) : (
        <div className="mb-8 space-y-4">
          <h2 className="text-lg font-semibold">Progress</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <div className="h-5 w-28 animate-pulse rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="h-[260px] w-full animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="h-5 w-24 animate-pulse rounded bg-muted" />
              </CardHeader>
              <CardContent className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-1">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                    <div className="h-1.5 w-full animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Filters + header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold">Session History</h2>
        <div className="flex gap-2">
          <select
            value={typeFilter}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="rounded-md border bg-background px-3 py-1.5 text-sm"
          >
            <option value="all">All Types</option>
            <option value="behavioral">Behavioral</option>
            <option value="technical">Technical</option>
          </select>
          <select
            value={scoreFilter}
            onChange={(e) => handleScoreChange(e.target.value)}
            className="rounded-md border bg-background px-3 py-1.5 text-sm"
          >
            <option value="all">All Scores</option>
            <option value="high">7+ (Good)</option>
            <option value="mid">4-6 (Average)</option>
            <option value="low">0-3 (Needs Work)</option>
          </select>
        </div>
      </div>

      {/* Session list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="h-6 w-8 animate-pulse rounded bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {typeFilter !== "all" || scoreFilter !== "all" ? (
              "No sessions match your filters."
            ) : (
              <>
                No completed sessions yet. Start a{" "}
                <Link href="/interview/behavioral/setup" className="text-primary underline">
                  behavioral
                </Link>{" "}
                or{" "}
                <Link href="/interview/technical/setup" className="text-primary underline">
                  technical
                </Link>{" "}
                interview to get started.
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => {
            const score = session.overallScore;
            const scoreColor = score != null ? getScoreColor(score) : null;
            return (
              <Link
                key={session.id}
                href={`/dashboard/sessions/${session.id}/feedback`}
              >
                <Card className="transition-colors hover:bg-accent/30">
                  <CardContent className="flex items-center gap-4 p-4">
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {session.type === "behavioral" ? "BQ" : "TC"}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {getSessionLabel(session)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(session.createdAt)}
                        {session.durationSeconds != null &&
                          ` · ${formatDuration(session.durationSeconds)}`}
                      </p>
                    </div>
                    {score != null && scoreColor && (
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${scoreColor.border} ${scoreColor.bg}`}
                      >
                        <span className={`text-sm font-bold ${scoreColor.text}`}>
                          {score.toFixed(1)}
                        </span>
                      </div>
                    )}
                    {score == null && (
                      <span className="text-xs text-muted-foreground">
                        No feedback
                      </span>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination controls */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
            {" "}({pagination.totalCount} sessions)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
