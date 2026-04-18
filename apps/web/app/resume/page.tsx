import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userResumes } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getCurrentUserPlan } from "@/lib/user-plan";
import { hasFeature } from "@/lib/features";
import { FeaturePaywall } from "@/components/billing/FeaturePaywall";
import ResumeClient from "./ResumeClient";

/**
 * Resume tools (upload + AI-tailored questions) are Pro-only. Server
 * component shell so free users never see the editor UI flash before the
 * check resolves. Mirrors `app/planner/page.tsx` — the two Pro-gated
 * surfaces share the same pattern.
 */
export default async function ResumePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/resume");
  }

  const plan = await getCurrentUserPlan(session.user.id);
  if (hasFeature(plan, "resume")) {
    return <ResumeClient />;
  }

  // Free tier — grandfather access for existing data, paywall otherwise.
  const existing = await db
    .select({ id: userResumes.id })
    .from(userResumes)
    .where(eq(userResumes.userId, session.user.id))
    .limit(1);

  if (existing.length > 0) {
    return <ResumeClient isReadOnly />;
  }

  return <FeaturePaywall feature="resume" />;
}
