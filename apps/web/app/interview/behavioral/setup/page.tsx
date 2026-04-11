"use client";

import { BehavioralSetupForm } from "@/components/interview/BehavioralSetupForm";
import { SessionQuota } from "@/components/interview/SessionQuota";

export default function BehavioralSetupPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">Behavioral Interview Setup</h1>
      <p className="mb-8 text-muted-foreground">
        Configure your mock interview. The AI interviewer will adapt based on
        these settings.
      </p>

      <SessionQuota />
      <div className="mt-6">
        <BehavioralSetupForm />
      </div>
    </div>
  );
}
