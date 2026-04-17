"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm leading-relaxed">
        {children}
      </CardContent>
    </Card>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-md border bg-primary/5 px-4 py-3 text-sm">
      <span className="shrink-0 text-primary">*</span>
      <span>{children}</span>
    </div>
  );
}

export default function CommunicationPage() {
  return (
    <div className="space-y-6">
      {/* Migrated content */}
      <Section title="Communication Fundamentals">
        <p>
          Technical skill gets you the interview. Communication skill gets you
          the offer. These tips apply to every interview type.
        </p>
        <div className="space-y-3">
          <div className="rounded-md border p-3">
            <p className="font-semibold text-primary">Think Out Loud</p>
            <p className="text-muted-foreground">
              Interviewers want to see your thought process, not just the answer.
              Narrate your reasoning: &quot;I&apos;m considering X because...&quot;, &quot;The trade-off here is...&quot;
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="font-semibold text-primary">Structure Your Answers</p>
            <p className="text-muted-foreground">
              Start with a summary, then dive into details. &quot;I&apos;d approach this in three steps...&quot;
              gives the interviewer a roadmap before you start.
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="font-semibold text-primary">Ask Good Questions</p>
            <p className="text-muted-foreground">
              Asking clarifying questions shows maturity. &quot;Before I start, can I clarify...&quot;
              is always better than making assumptions.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Body Language & Presence">
        <div className="space-y-2">
          <Tip>Maintain eye contact with the camera in video calls — not the screen. This is what face-to-face eye contact looks like on video.</Tip>
          <Tip>Smile genuinely, especially at the start and end. Positivity is contagious and memorable.</Tip>
          <Tip>Sit up straight and lean slightly forward. It conveys engagement and confidence.</Tip>
          <Tip>Pace yourself. Speaking too fast signals nervousness. Pause before answering — 2-3 seconds of thinking is perfectly fine.</Tip>
          <Tip>Avoid filler words (&quot;um&quot;, &quot;like&quot;, &quot;you know&quot;). Replace them with brief pauses — silence is powerful.</Tip>
        </div>
      </Section>

      <Section title="Handling Difficult Moments">
        <div className="space-y-2">
          <Tip>If you&apos;re stuck, say so: &quot;I&apos;m not sure about X, but here&apos;s how I&apos;d approach figuring it out...&quot; Honesty beats pretending.</Tip>
          <Tip>If you made a mistake, own it quickly: &quot;Actually, let me correct that...&quot; Don&apos;t hope they didn&apos;t notice.</Tip>
          <Tip>If you don&apos;t know the answer, pivot: &quot;I haven&apos;t worked with X directly, but with Y which is similar, I would...&quot;</Tip>
          <Tip>If you run out of time, summarize what you&apos;d do next: &quot;Given more time, I&apos;d optimize this by...&quot;</Tip>
        </div>
      </Section>

      {/* New: Voice Delivery */}
      <Section title="Voice Delivery">
        <p>
          Your voice carries signals beyond your words. Interviewers notice pace,
          clarity, and how you handle silence. You don&apos;t need a broadcast voice —
          you need a clear, confident one.
        </p>
        <div className="space-y-3">
          <div className="rounded-md border p-3">
            <p className="font-semibold text-primary">Pace</p>
            <p className="text-muted-foreground">
              Target roughly 150 words per minute — conversational but not rushed.
              If you notice yourself speeding up, it&apos;s usually a sign of anxiety.
              Slow down intentionally after you finish a point.
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="font-semibold text-primary">Filler words</p>
            <p className="text-muted-foreground">
              &quot;Um&quot;, &quot;like&quot;, &quot;you know&quot;, &quot;basically&quot;, and &quot;right&quot; are the most common.
              They surface under pressure. The fix is practice — not elimination
              through willpower, but building the habit of pausing instead.
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="font-semibold text-primary">Strategic pauses</p>
            <p className="text-muted-foreground">
              Silence between thoughts is powerful, not awkward. A two-second
              pause after a question shows you&apos;re thinking, not scrambling. Don&apos;t
              fill every moment of silence — let your answers breathe.
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="font-semibold text-primary">Tone and clarity</p>
            <p className="text-muted-foreground">
              Project confidence by ending declarative sentences on a level or
              falling tone — not a rising one. Upward inflection on statements
              can make confident claims sound like questions. Record yourself once
              to hear how you actually sound.
            </p>
          </div>
        </div>
      </Section>

      {/* New: Written/Async communication */}
      <Section title="Written & Async Communication">
        <p>
          Some interview loops include a take-home or expect follow-up
          communication. These are scored too.
        </p>
        <div className="space-y-2">
          <Tip>
            After an in-person or video interview, send a short thank-you email
            within 24 hours. One paragraph — genuine, specific, not generic.
          </Tip>
          <Tip>
            For take-home projects: include a README that explains your decisions.
            Reviewers read the README before the code.
          </Tip>
          <Tip>
            Commit messages matter in take-home submissions. &quot;initial commit&quot;
            followed by &quot;fix&quot; followed by &quot;fix2&quot; signals sloppy process.
          </Tip>
          <Tip>
            Call out edge-case coverage in your README or submission email. Don&apos;t
            assume reviewers will find it — tell them where to look.
          </Tip>
        </div>
      </Section>

      {/* Cross-links */}
      <Card>
        <CardContent className="pt-4 text-sm">
          <p className="mb-3 text-muted-foreground">
            Communication is scored in every session — behavioral and technical
            alike. Pair this page with hands-on practice.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/coaching/behavioral" className="flex-1">
              <Button variant="outline" className="w-full">
                Behavioral Coaching
              </Button>
            </Link>
            <Link href="/coaching/technical" className="flex-1">
              <Button variant="outline" className="w-full">
                Technical Coaching
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
