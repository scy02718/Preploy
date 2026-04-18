"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TemplateManager } from "@/components/profile/TemplateManager";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle } from "lucide-react";
import { signOut } from "next-auth/react";
import { PLANS, PLAN_DEFINITIONS } from "@/lib/plans";
import type { PlanId } from "@/lib/plans";

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  plan: PlanId;
  stripeCustomerId: string | null;
  disabledAt: string | null;
  gazeTrackingEnabled: boolean;
  createdAt: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Editable fields
  const [name, setName] = useState("");

  // UI state
  const [isSavingName, setIsSavingName] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBillingLoading, setIsBillingLoading] = useState(false);
  const [isTogglingGaze, setIsTogglingGaze] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
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

  const handleToggleGaze = async (enabled: boolean) => {
    setIsTogglingGaze(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gaze_tracking_enabled: enabled }),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile((p) =>
          p ? { ...p, gazeTrackingEnabled: data.gazeTrackingEnabled } : p
        );
        showMessage(
          "success",
          enabled
            ? "Gaze & presence analysis enabled"
            : "Gaze & presence analysis disabled"
        );
      } else {
        const err = await res.json().catch(() => ({}));
        showMessage("error", err.error || "Failed to update setting");
      }
    } catch {
      showMessage("error", "Failed to update setting");
    } finally {
      setIsTogglingGaze(false);
    }
  };

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

  const handleManageBilling = async () => {
    setIsBillingLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
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

  const handleUpgrade = async (interval: "month" | "year") => {
    setIsBillingLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.location.assign(data.url);
          return;
        }
        showMessage("error", "Checkout returned no URL");
      } else {
        const err = await res.json().catch(() => ({}));
        showMessage("error", err.error || "Failed to start checkout");
      }
    } catch {
      showMessage("error", "Failed to start checkout");
    } finally {
      setIsBillingLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "DELETE my account and all my data") return;
    setIsDeleting(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: deleteConfirmation }),
      });
      if (res.ok || res.status === 204) {
        // signOut() calls NextAuth's /api/auth/signout which properly
        // clears the session cookie, then redirects to the homepage.
        await signOut({ callbackUrl: "/?deleted=1" });
        return;
      }
      const err = await res.json().catch(() => ({}));
      showMessage("error", err.error || "Failed to delete account");
    } catch {
      showMessage("error", "Failed to delete account");
    } finally {
      setIsDeleting(false);
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
          {/* Left column — Profile Information + Gaze & Presence */}
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
            <Card>
              <CardHeader>
                <div className="h-5 w-48 animate-pulse rounded bg-muted" />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-4 w-full animate-pulse rounded bg-muted" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-6 w-12 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          </div>

          {/* Right column — Plan + Billing + Templates + Preferences + Danger Zone */}
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
            <Card className="hidden md:block">
              <CardHeader>
                <div className="h-5 w-24 animate-pulse rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="h-9 w-40 animate-pulse rounded bg-muted" />
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
        {/* Left column — Profile Info + Gaze & Presence */}
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

          <Card>
            <CardHeader>
              <CardTitle>Gaze &amp; Presence Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Analyze your gaze and head pose during behavioral practice
                sessions to get insights on presence and eye contact. All
                processing happens on your device — no video leaves your
                browser.{" "}
                <a
                  href="/privacy#gaze-presence-analysis"
                  className="underline hover:text-foreground"
                >
                  Privacy details
                </a>
              </p>
              <div className="flex items-center gap-3">
                <Switch
                  id="gaze-tracking-toggle"
                  checked={profile.gazeTrackingEnabled}
                  onCheckedChange={handleToggleGaze}
                  disabled={isTogglingGaze}
                  data-testid="gaze-tracking-switch"
                />
                <Label htmlFor="gaze-tracking-toggle" className="cursor-pointer">
                  {profile.gazeTrackingEnabled ? "Enabled" : "Disabled"}
                </Label>
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
                  ? `You're on the Free plan with ${PLAN_DEFINITIONS.free.limits.monthlyInterviews} mock interviews per month. Upgrade below for ${PLAN_DEFINITIONS.pro.limits.monthlyInterviews}/month.`
                  : `You're on the Pro plan with ${PLAN_DEFINITIONS.pro.limits.monthlyInterviews} mock interviews per month. Manage your subscription below.`}
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
                    onClick={handleManageBilling}
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
                    Upgrade to Pro for {PLAN_DEFINITIONS.pro.limits.monthlyInterviews} mock
                    interviews per month. Pick monthly or annual — annual saves
                    about 33%.
                  </p>
                  <Button
                    onClick={() => handleUpgrade("month")}
                    disabled={isBillingLoading}
                    data-testid="upgrade-button"
                    className="w-full"
                  >
                    {isBillingLoading
                      ? "Loading..."
                      : `Upgrade — $${PLAN_DEFINITIONS.pro.priceUsd}/month`}
                  </Button>
                  <Button
                    onClick={() => handleUpgrade("year")}
                    disabled={isBillingLoading}
                    data-testid="upgrade-annual-button"
                    variant="outline"
                    className="w-full"
                  >
                    {isBillingLoading
                      ? "Loading..."
                      : `Upgrade — $${PLAN_DEFINITIONS.pro.annualMonthlyEquivalentUsd}/month billed annually ($${PLAN_DEFINITIONS.pro.annualTotalUsd}/year)`}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <TemplateManager />

          <Card className="hidden md:block" data-testid="preferences-card">
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
              <CardDescription>Personalize your experience</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                data-testid="take-tour-again-button"
                onClick={() => router.push("/dashboard?tour=1")}
              >
                Take the tour again
              </Button>
            </CardContent>
          </Card>

          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                Delete Account
              </CardTitle>
            </CardHeader>
            <CardContent>
              {showDeleteConfirm ? (
                <div className="space-y-3">
                  <p className="text-sm text-destructive">
                    This will <strong>permanently delete</strong> your account
                    and all associated data: interview sessions, transcripts,
                    feedback, STAR stories, resume uploads, saved questions,
                    templates, achievements, and billing records. This action
                    cannot be undone.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="delete-confirm" className="text-sm">
                      Type <strong>DELETE my account and all my data</strong> to
                      confirm:
                    </Label>
                    <Input
                      id="delete-confirm"
                      value={deleteConfirmation}
                      onChange={(e) => setDeleteConfirmation(e.target.value)}
                      placeholder="DELETE my account and all my data"
                      className="border-destructive/50"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      onClick={handleDeleteAccount}
                      disabled={
                        isDeleting ||
                        deleteConfirmation !== "DELETE my account and all my data"
                      }
                    >
                      {isDeleting
                        ? "Deleting..."
                        : "Permanently delete my account"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirmation("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Permanently delete your account and all your data. This
                    cannot be undone.
                  </p>
                  <Button
                    variant="destructive"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    Delete Account
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
