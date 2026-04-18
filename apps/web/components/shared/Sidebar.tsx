"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { FeedbackDialog } from "@/components/shared/FeedbackButton";
import {
  LayoutDashboard,
  MessageSquare,
  Code,
  GraduationCap,
  CalendarDays,
  FileText,
  History,
  Star,
  Trophy,
} from "lucide-react";

const navItems: Array<{
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Pro-gated features get a "Pro" badge next to their label for
   *  free-tier users (discovery over hiding). The link still navigates —
   *  the destination page renders the paywall. */
  proOnly?: boolean;
}> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/interview/behavioral/setup", label: "Behavioral Interview", icon: MessageSquare },
  { href: "/interview/technical/setup", label: "Technical Interview", icon: Code },
  { href: "/star", label: "STAR Prep", icon: Star },
  { href: "/coaching", label: "Coaching", icon: GraduationCap },
  { href: "/planner", label: "Planner", icon: CalendarDays, proOnly: true },
  { href: "/resume", label: "Resume", icon: FileText, proOnly: true },
  { href: "/achievements", label: "Achievements", icon: Trophy },
];

interface SessionItem {
  id: string;
  type: "behavioral" | "technical";
  config: Record<string, unknown>;
  status: string;
  createdAt: string;
}

function getSessionLabel(session: SessionItem): string {
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

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  return `${diffWeeks}w ago`;
}

export function Sidebar() {
  const pathname = usePathname();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  // `undefined` = plan fetch hasn't resolved yet; we render nav items
  // without the "Pro" badge until it resolves to avoid a visible flip.
  const [plan, setPlan] = useState<"free" | "pro" | undefined>(undefined);
  const isFree = plan === "free";

  useEffect(() => {
    async function fetchSessions() {
      try {
        const res = await fetch("/api/sessions?limit=5&page=1");
        if (res.ok) {
          const data = await res.json();
          // API now returns { sessions, pagination }
          const list: SessionItem[] = data.sessions ?? data;
          setSessions(list.slice(0, 5));
        }
      } catch {
        // Silent — sidebar sessions are non-critical
      } finally {
        setSessionsLoading(false);
      }
    }
    fetchSessions();
  }, []);

  useEffect(() => {
    async function fetchPlan() {
      try {
        const res = await fetch("/api/users/me");
        if (res.ok) {
          const data = await res.json();
          // "max" is legacy — treat as Pro for badging purposes.
          setPlan(data.plan === "pro" || data.plan === "max" ? "pro" : "free");
        }
      } catch {
        // Silent — absence of the badge is the safe default.
      }
    }
    fetchPlan();
  }, []);

  return (
    <aside className="flex flex-col h-full py-4">
      <div className="px-4 mb-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Navigation
        </p>
      </div>

      <nav className="flex flex-col gap-1 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const showProBadge = isFree && item.proOnly;
          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={`sidebar-nav-${item.href.replace(/\W+/g, "-").replace(/^-|-$/g, "")}`}
              aria-label={
                showProBadge ? `${item.label} (Pro feature)` : undefined
              }
              className={cn(
                "flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
                pathname.startsWith(item.href)
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1 truncate">{item.label}</span>
              {showProBadge && (
                <Badge
                  variant="outline"
                  className="shrink-0 border-primary/40 bg-primary/10 px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide text-primary"
                >
                  Pro
                </Badge>
              )}
            </Link>
          );
        })}

        {/* Feedback trigger — opens the dialog, not navigation */}
        <button
          onClick={() => setFeedbackOpen(true)}
          data-testid="sidebar-feedback-button"
          className="flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-accent/50 w-full text-left"
        >
          <MessageSquare className="h-4 w-4" />
          Feedback
        </button>
      </nav>

      <Separator className="my-4" />

      <div className="px-4 mb-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <History className="h-3 w-3" />
          Recent Sessions
        </p>
      </div>

      <div className="flex flex-col gap-1 px-2">
        {sessionsLoading ? (
          // Skeleton mirrors the post-load row shape: two-line label +
          // trailing type badge. Three rows cover the common case (recent
          // sessions max out at 5, but most users have fewer in view).
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-3 py-2"
              aria-hidden="true"
            >
              <div className="flex flex-col min-w-0 mr-2 flex-1 gap-1">
                <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                <div className="h-2.5 w-12 animate-pulse rounded bg-muted/60" />
              </div>
              <div className="h-4 w-7 shrink-0 animate-pulse rounded-full bg-muted" />
            </div>
          ))
        ) : sessions.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            No sessions yet
          </p>
        ) : (
          sessions.map((session) => (
            <Link
              key={session.id}
              href={`/dashboard/sessions/${session.id}/feedback`}
              className="flex items-center justify-between px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-md transition-colors"
            >
              <div className="flex flex-col min-w-0 mr-2">
                <span className="truncate">{getSessionLabel(session)}</span>
                <span className="text-[10px] text-muted-foreground/60">
                  {formatRelativeDate(session.createdAt)}
                </span>
              </div>
              <Badge variant="secondary" className="text-[10px] shrink-0">
                {session.type === "behavioral" ? "BQ" : "TC"}
              </Badge>
            </Link>
          ))
        )}
      </div>

      {/* Controlled feedback dialog — rendered here so it's scoped to the Sidebar */}
      <FeedbackDialog
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />
    </aside>
  );
}
