"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Tiny client component that POSTs to `/api/billing/checkout` and redirects
 * to the returned Stripe URL. Extracted from the monolithic
 * `UpgradePromptDialog` so server-rendered paywalls and read-only banners
 * can embed the same upgrade flow without pulling in the dialog chrome.
 */
export function UpgradeCheckoutButton({
  className,
  size = "default",
  children,
}: {
  className?: string;
  size?: "default" | "sm" | "lg";
  children?: React.ReactNode;
}) {
  const [isUpgrading, setIsUpgrading] = useState(false);

  async function handleClick() {
    setIsUpgrading(true);
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      if (!res.ok) {
        setIsUpgrading(false);
        return;
      }
      const data = await res.json();
      if (data.url) {
        window.location.assign(data.url);
        return;
      }
      setIsUpgrading(false);
    } catch {
      setIsUpgrading(false);
    }
  }

  return (
    <Button
      onClick={handleClick}
      disabled={isUpgrading}
      size={size}
      className={cn(className)}
    >
      {isUpgrading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          Loading...
        </>
      ) : (
        children ?? "Upgrade to Pro"
      )}
    </Button>
  );
}
