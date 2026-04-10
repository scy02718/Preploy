"use client";

import { TechnicalSetupForm } from "@/components/interview/TechnicalSetupForm";

export default function TechnicalSetupPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">Technical Interview Setup</h1>
      <p className="mb-8 text-muted-foreground">
        Configure your mock coding interview. The AI will generate a problem and
        analyze your approach.
      </p>

      <TechnicalSetupForm />
    </div>
  );
}
