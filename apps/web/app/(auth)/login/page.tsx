import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://preploy.tech";

export const metadata: Metadata = {
  title: "Sign In — Preploy",
  description: "Sign in to Preploy to access your AI mock interview sessions and track your progress.",
  alternates: {
    canonical: `${BASE_URL}/login`,
  },
  robots: {
    index: true,
    follow: true,
  },
};

// NextAuth v5 redirects failed sign-ins to `/login?error=<code>`. Map the
// codes we're likely to see to user-facing copy; fall back to a generic
// "something went wrong" for anything unrecognised. See
// https://authjs.dev/reference/core/errors for the full list.
function resolveAuthError(code: string | undefined): string | null {
  if (!code) return null;
  switch (code) {
    case "OAuthAccountNotLinked":
      return "This email is already linked to a different sign-in method. Use the method you originally signed up with.";
    case "AccessDenied":
      return "Sign-in was cancelled or denied. Please try again if you meant to sign in.";
    case "Configuration":
      return "The sign-in service is misconfigured. Please contact support if this keeps happening.";
    case "Verification":
      return "Your sign-in link expired or was already used. Please try again.";
    case "OAuthSignin":
    case "OAuthCallback":
    case "OAuthCreateAccount":
    case "Callback":
      return "We couldn't complete sign-in with Google. Please try again.";
    default:
      return "Something went wrong signing you in. Please try again.";
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const params = await searchParams;
  const errorCode = Array.isArray(params.error) ? params.error[0] : params.error;
  const errorMessage = resolveAuthError(errorCode);

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)] px-4">
      <div className="w-full max-w-sm space-y-4">
        <Link
          href="/"
          className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to home
        </Link>

        {errorMessage && (
          <div
            role="alert"
            aria-live="assertive"
            className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Sign in to Preploy</CardTitle>
            <CardDescription>
              Continue with Google to pick up where you left off.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/dashboard" });
              }}
            >
              <Button className="w-full" size="lg" type="submit">
                Sign in with Google
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
