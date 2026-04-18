import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://preploy.tech";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to Preploy to access your AI mock interview sessions and track your progress.",
  alternates: {
    canonical: `${BASE_URL}/login`,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function LoginPage() {
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
