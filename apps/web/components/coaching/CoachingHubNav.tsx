"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const TABS = [
  { label: "Hiring Overview", href: "/coaching/hiring-overview" },
  { label: "Behavioral", href: "/coaching/behavioral" },
  { label: "Technical", href: "/coaching/technical" },
  { label: "Communication", href: "/coaching/communication" },
] as const;

export function CoachingHubNav() {
  const pathname = usePathname();
  const router = useRouter();

  const currentTab = TABS.find((tab) => pathname.startsWith(tab.href));
  const currentLabel = currentTab?.label ?? "Hiring Overview";

  return (
    <nav aria-label="Coaching hub navigation">
      {/* Desktop tab rail — visible at md and above */}
      <div className="hidden md:flex gap-1 border-b mb-6">
        {TABS.map((tab) => {
          const isActive = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2",
                isActive
                  ? "bg-accent text-accent-foreground border-primary"
                  : "text-muted-foreground hover:text-foreground border-transparent hover:border-muted-foreground/30"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Mobile dropdown picker — visible below md */}
      <div className="md:hidden mb-6">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
            aria-label="Select coaching topic"
          >
            <span>{currentLabel}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-full min-w-[200px]">
            {TABS.map((tab) => (
              <DropdownMenuItem
                key={tab.href}
                onClick={() => router.push(tab.href)}
              >
                {tab.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
