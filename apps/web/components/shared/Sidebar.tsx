"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  MessageSquare,
  Code,
  GraduationCap,
  CalendarDays,
  FileText,
  History,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/interview/behavioral/setup", label: "Behavioral Interview", icon: MessageSquare },
  { href: "/interview/technical/setup", label: "Technical Interview", icon: Code },
  { href: "/coaching", label: "Coaching", icon: GraduationCap },
  { href: "/planner", label: "Planner", icon: CalendarDays },
  { href: "/resume", label: "Resume", icon: FileText },
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
      }
    }
    fetchSessions();
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
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
                pathname.startsWith(item.href)
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Separator className="my-4" />

      <div className="px-4 mb-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <History className="h-3 w-3" />
          Recent Sessions
        </p>
      </div>

      <div className="flex flex-col gap-1 px-2">
        {sessions.length === 0 ? (
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
    </aside>
  );
}
