"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  MessageSquare,
  Code,
  History,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/interview/behavioral/setup", label: "Behavioral Interview", icon: MessageSquare },
  { href: "/interview/technical/setup", label: "Technical Interview", icon: Code },
];

const recentSessions = [
  { id: "1", type: "behavioral", label: "Google - PM Role", date: "2 days ago" },
  { id: "2", type: "technical", label: "Sliding Window", date: "3 days ago" },
  { id: "3", type: "behavioral", label: "Meta - SWE Role", date: "1 week ago" },
];

export function Sidebar() {
  const pathname = usePathname();

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
        {recentSessions.map((session) => (
          <Link
            key={session.id}
            href={`/dashboard/sessions/${session.id}/feedback`}
            className="flex items-center justify-between px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-md transition-colors"
          >
            <span className="truncate">{session.label}</span>
            <Badge variant="secondary" className="text-[10px] shrink-0 ml-2">
              {session.type === "behavioral" ? "BQ" : "TC"}
            </Badge>
          </Link>
        ))}
      </div>
    </aside>
  );
}
