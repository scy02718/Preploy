"use client";

import { useEffect, useState, useCallback } from "react";
import { TemplateManager } from "@/components/profile/TemplateManager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PLANS } from "@/lib/plans";
import type { PlanId } from "@/lib/plans";

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  plan: PlanId;
  stripeCustomerId: string | null;
  disabledAt: string | null;
  createdAt: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Editable fields
  const [name, setName] = useState("");

  // UI state
  const [isSavingName, setIsSavingName] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [isBillingLoading, setIsBillingLoading] = useState(false);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/users/me");
        if (res.ok) {
          const data: UserProfile = await res.json();
          setProfile(data);
          setName(data.name ?? "");
        }
      } catch {
        // Silent
      } finally {
        setIsLoading(false);
      }
    }
    fetchProfile();
  }, []);

  const showMessage = useCallback((type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }, []);

  const handleSaveName = async () => {
    if (!name.trim()) return;
    setIsSavingName(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile((p) => (p ? { ...p, name: data.name } : p));
        showMessage("success", "Name updated");
      } else {
        const err = await res.json();
        showMessage("error", err.error || "Failed to update name");
      }
    } catch {
      showMessage("error", "Failed to update name");
    } finally {
      setIsSavingName(false);
    }
  };

  const handleBillingPortal = async () => {
    setIsBillingLoading(true);
    try {
      // Route by ACTUAL plan, not by `stripeCustomerId` existence.
      // A free user who started checkout but never completed it (e.g.
      // a misconfigured price ID) has a `stripe_customer_id` row but no
      // active subscription — they should still see "Upgrade to Pro" and
      // hit checkout, not the empty Stripe Billing Portal.
      const endpoint =
        profile?.plan === "pro"
          ? "/api/billing/portal"
          : "/api/billing/checkout";
      const res = await fetch(endpoint, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.location.assign(data.url);
          return;
        }
        showMessage("error", "Billing session returned no URL");
      } else {
        const err = await res.json().catch(() => ({}));
        showMessage("error", err.error || "Failed to open billing");
      }
    } catch {
      showMessage("error", "Failed to open billing");
    } finally {
      setIsBillingLoading(false);
    }
  };

  const handleDisableAccount = async () => {
    setIsDisabling(true);
    try {
      const res = await fetch("/api/users/me/disable", { method: "POST" });
      if (res.ok) {
        setProfile((p) => (p ? { ...p, disabledAt: new Date().toISOString() } : p));
        setShowDisableConfirm(false);
        showMessage("success", "Account disabled. You can no longer create new sessions.");
      } else {
        const err = await res.json();
        showMessage("error", err.error || "Failed to disable account");
      }
    } catch {
      showMessage("error", "Failed to disable account");
    } finally {
      setIsDisabling(false);
    }
  };

  if (isLoading) {
    // Skeleton shape mirrors the post-load layout exactly: 1 card on the
    // left (Profile Information), 4 cards on the right (Plan, Billing,
    // Templates, Danger Zone). Adding/removing cards here without updating
    // the skeleton causes the "pop-in" UX the user noticed in earlier waves.
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        <div className="h-4 w-72 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Left column — Profile Information */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="h-5 w-40 animate-pulse rounded bg-muted" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-4 w-12 animate-pulse rounded bg-muted" />
                <div className="h-10 w-full animate-pulse rounded bg-muted" />
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-10 w-full animate-pulse rounded bg-muted" />
                <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          </div>

          {/* Right column — Plan + Billing + Templates + Danger Zone */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="h-5 w-12 animate-pulse rounded bg-muted" />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-12 w-full animate-pulse rounded bg-muted" />
                <div className="h-12 w-full animate-pulse rounded bg-muted" />
                <div className="h-12 w-full animate-pulse rounded bg-muted" />
                <div className="h-9 w-full animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="h-5 w-16 animate-pulse rounded bg-muted" />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-4 w-full animate-pulse rounded bg-muted" />
                <div className="h-9 w-full animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="h-5 w-20 animate-pulse rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="h-20 w-full animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="h-5 w-24 animate-pulse rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="h-9 w-32 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const isDisabled = !!profile.disabledAt;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">Profile</h1>
      <p className="mb-8 text-muted-foreground">
        Manage your account settings and preferences.
      </p>

      {/* Toast message */}
      {message && (
        <div
          className={`mb-6 rounded-md border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400"
              : "border-destructive/50 bg-destructive/10 text-destructive"
          }`}
        >
          {message.text}
        </div>
      )}

      {isDisabled && (
        <div className="mb-6 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Your account is disabled. You cannot create new sessions.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Left column — Profile Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={profile.email} disabled />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Display Name</Label>
                <div className="flex gap-2">
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={200}
                    placeholder="Your name"
                  />
                  <Button
                    onClick={handleSaveName}
                    disabled={isSavingName || name.trim() === (profile.name ?? "")}
                    variant="outline"
                  >
                    {isSavingName ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Member Since</Label>
                <p className="text-sm text-muted-foreground">
                  {new Date(profile.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column — Plan + Account */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Plan</CardTitle>
                <Badge variant="secondary">{PLANS[profile.plan].name}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {profile.plan === "free"
                  ? "You're on the Free plan with 3 mock interviews per month. Upgrade below to remove the limit."
                  : "You're on the Pro plan with unlimited mock interviews. Manage your subscription below."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Billing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {profile.plan === "pro" ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Update your card, view invoices, or cancel your subscription
                    on Stripe&apos;s secure portal.
                  </p>
                  <Button
                    onClick={handleBillingPortal}
                    disabled={isBillingLoading}
                    data-testid="manage-billing-button"
                    className="w-full"
                  >
                    {isBillingLoading ? "Opening..." : "Manage billing"}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Upgrade to Pro to remove the monthly interview limit and
                    unlock all features.
                  </p>
                  <Button
                    onClick={handleBillingPortal}
                    disabled={isBillingLoading}
                    data-testid="upgrade-button"
                    className="w-full"
                  >
                    {isBillingLoading ? "Loading..." : "Upgrade to Pro"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <TemplateManager />

          <Card>
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              {isDisabled ? (
                <p className="text-sm text-muted-foreground">
                  Account disabled on{" "}
                  {new Date(profile.disabledAt!).toLocaleDateString()}.
                  Contact support to re-enable.
                </p>
              ) : showDisableConfirm ? (
                <div className="space-y-3">
                  <p className="text-sm">
                    Are you sure? You won&apos;t be able to create new sessions.
                    Your existing feedback will remain accessible.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      onClick={handleDisableAccount}
                      disabled={isDisabling}
                    >
                      {isDisabling ? "Disabling..." : "Yes, disable my account"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowDisableConfirm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="destructive"
                  onClick={() => setShowDisableConfirm(true)}
                >
                  Disable Account
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
