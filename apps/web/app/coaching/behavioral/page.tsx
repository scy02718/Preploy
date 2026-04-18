"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompetencyChips } from "@/components/coaching/CompetencyChips";
import type { CompetencyItem } from "@/components/coaching/CompetencyChips";
import { Lightbulb } from "lucide-react";

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
    <div className="flex gap-3 rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
      <Lightbulb
        className="mt-0.5 h-4 w-4 shrink-0 text-primary"
        aria-hidden="true"
      />
      <span>{children}</span>
    </div>
  );
}

const COMPETENCY_ITEMS: CompetencyItem[] = [
  {
    competency: "Leadership",
    questions: [
      "Tell me about a time you led a team through a difficult situation.",
      "Describe a moment when you had to influence others without formal authority.",
      "How have you handled a team member who wasn't meeting expectations?",
    ],
  },
  {
    competency: "Conflict",
    questions: [
      "Describe a disagreement with a colleague and how you resolved it.",
      "Tell me about a time you had to push back on a decision from a manager.",
      "How did you handle a situation where your team had conflicting priorities?",
    ],
  },
  {
    competency: "Ambiguity",
    questions: [
      "Tell me about a time you had to make a decision with incomplete information.",
      "Describe a project where the requirements kept changing — how did you adapt?",
      "How do you prioritize when everything seems urgent?",
    ],
  },
  {
    competency: "Impact",
    questions: [
      "What is the most impactful project you've shipped? How did you measure it?",
      "Tell me about a time you drove a measurable improvement for customers or the business.",
      "Describe a decision you made that had downstream effects you hadn't anticipated.",
    ],
  },
  {
    competency: "Teamwork",
    questions: [
      "Give an example of a successful cross-functional collaboration.",
      "Tell me about a time you helped a teammate who was struggling.",
      "How have you contributed to a team culture you're proud of?",
    ],
  },
  {
    competency: "Failure",
    questions: [
      "Tell me about a project or decision that didn't go as planned. What did you learn?",
      "Describe a time you made a technical mistake in production. What happened next?",
      "What is the biggest professional setback you've faced and how did you recover?",
    ],
  },
  {
    competency: "Innovation",
    questions: [
      "Tell me about a time you proposed a new approach that improved an existing process.",
      "Describe a creative solution you built under significant constraints.",
      "How do you stay current with new technologies and decide which ones to adopt?",
    ],
  },
  {
    competency: "Growth",
    questions: [
      "Tell me about a skill you had to develop quickly for a new role or project.",
      "Describe a piece of critical feedback you received and how you acted on it.",
      "What does your approach to continuous learning look like in practice?",
    ],
  },
];

export default function BehavioralPage() {
  return (
    <div className="space-y-6">
      {/* STAR Prep CTA */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col gap-3 pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Build your STAR story bank</p>
            <p className="text-muted-foreground">
              Write and refine structured stories you can draw on in any
              behavioral round.
            </p>
          </div>
          <Link href="/star" className="shrink-0">
            <Button variant="outline" size="sm">
              Go to STAR Prep
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Migrated content */}
      <Section title="The STAR Method">
        <p>
          The STAR method is the gold standard for structuring behavioral
          interview answers. Every answer should follow this framework:
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-md border p-3">
            <p className="font-semibold text-primary">S — Situation</p>
            <p className="text-muted-foreground">
              Set the scene. Where were you? What was the context? Keep it to 1-2
              sentences.
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="font-semibold text-primary">T — Task</p>
            <p className="text-muted-foreground">
              What was your specific responsibility? What were you trying to
              achieve?
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="font-semibold text-primary">A — Action</p>
            <p className="text-muted-foreground">
              What did YOU do? Be specific. Use &quot;I&quot; not &quot;we&quot;. This is the
              longest part — 60% of your answer.
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="font-semibold text-primary">R — Result</p>
            <p className="text-muted-foreground">
              What happened? Use metrics when possible. &quot;Reduced load time by
              40%&quot; beats &quot;things improved.&quot;
            </p>
          </div>
        </div>
      </Section>

      {/* Interviewer rubric */}
      <Section title="What Interviewers Look For">
        <p>
          Beyond structure, interviewers score your answers on six dimensions:
        </p>
        <div className="space-y-2">
          {[
            {
              label: "Structure",
              desc: "Does your answer follow STAR? Can the interviewer follow the narrative without mental effort?",
            },
            {
              label: "Specificity",
              desc: "Are you using concrete details — team size, timelines, metrics — or vague generalities?",
            },
            {
              label: "Self-awareness",
              desc: "Do you demonstrate honest reflection? Interviewers notice when candidates avoid acknowledging their role in failures.",
            },
            {
              label: "Ownership",
              desc: "Do you use 'I' instead of 'we'? Interviewers want to understand your individual contribution.",
            },
            {
              label: "Impact",
              desc: "What changed because of your actions? Quantify wherever possible.",
            },
            {
              label: "Reflection",
              desc: "What would you do differently? Showing learning signals maturity.",
            },
          ].map(({ label, desc }) => (
            <div key={label} className="rounded-md border p-3">
              <p className="font-semibold text-primary">{label}</p>
              <p className="text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Red flags */}
      <Section title="Red Flags to Avoid">
        <div className="space-y-2">
          <Tip>
            Rambling without a clear ending. If your answer doesn&apos;t have a
            result, stop and add one.
          </Tip>
          <Tip>
            No concrete outcome. &quot;We improved things&quot; without a metric is a
            weak close. Even rough numbers help: &quot;roughly 30% faster.&quot;
          </Tip>
          <Tip>
            Overusing &quot;we&quot; without clarifying your role. Replace at least some
            instances with &quot;I&quot; and explain your specific contribution.
          </Tip>
          <Tip>
            Blame-shifting. If a project failed, own your part. &quot;The PM made
            bad decisions&quot; tells the interviewer nothing about you.
          </Tip>
        </div>
      </Section>

      {/* Worked example */}
      <Section title="Worked Example">
        <p className="font-medium">
          Question: &quot;Tell me about a time you had to meet a tight deadline.&quot;
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-md border border-primary/25 bg-primary/5 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">
              Strong answer
            </p>
            <p className="text-muted-foreground">
              &quot;In Q3 last year, a partner needed our API integrated two weeks
              before I expected. I mapped the critical path, cut scope on
              non-essential logging, paired with the backend engineer for three
              days, and shipped on day twelve. The partner launched on schedule
              and renewed their contract. In hindsight I&apos;d have flagged the
              dependency risk earlier.&quot;
            </p>
          </div>
          <div className="rounded-md border border-destructive/25 bg-destructive/5 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-destructive">
              Weak answer
            </p>
            <p className="text-muted-foreground">
              &quot;Yeah, we had a project once where we needed to finish quickly.
              The team worked hard and we got it done. It was stressful but
              everything turned out fine in the end.&quot;
            </p>
          </div>
        </div>
      </Section>

      {/* Competency chips */}
      <Section title="Common Question Categories">
        <p>
          Click a competency to see example questions and jump straight into
          practice.
        </p>
        <CompetencyChips items={COMPETENCY_ITEMS} />
      </Section>

      <Section title="Tips for Success">
        <div className="space-y-2">
          <Tip>Be specific — vague answers score poorly. Name the project, the team size, the timeline.</Tip>
          <Tip>Use metrics whenever possible. &quot;Improved retention by 15%&quot; is more compelling than &quot;things got better.&quot;</Tip>
          <Tip>Practice storytelling. A good STAR answer is 2-3 minutes, not 30 seconds or 10 minutes.</Tip>
          <Tip>Prepare 8-10 stories that cover multiple categories. One leadership story might also cover conflict.</Tip>
          <Tip>Smile and maintain eye contact. Positivity matters more than you think.</Tip>
        </div>
      </Section>

      <Link href="/interview/behavioral/setup">
        <Button className="w-full">Practice Behavioral Interview</Button>
      </Link>
    </div>
  );
}
