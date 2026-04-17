"use client";

import { TechnicalSetupForm } from "@/components/interview/TechnicalSetupForm";
import { SessionQuota } from "@/components/interview/SessionQuota";
import { SessionCostBanner } from "@/components/interview/SessionCostBanner";

export default function TechnicalSetupPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">Technical Interview Setup</h1>
      <p className="mb-8 text-muted-foreground">
        Configure your mock coding interview. The AI will generate a problem and
        analyze your approach.
      </p>

      <SessionQuota />
      <div className="mt-3">
        <SessionCostBanner />
      </div>
      <div className="mt-6">
        <TechnicalSetupForm />
      </div>
    </div>
  );
}
