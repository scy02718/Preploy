import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FunnelStepper } from "@/components/coaching/FunnelStepper";
import type { FunnelStage } from "@/components/coaching/FunnelStepper";

const FUNNEL_STAGES: FunnelStage[] = [
  {
    number: 1,
    title: "Sourcing",
    who: "Recruiter or sourcer",
    signals: "Resume fit, keyword match, LinkedIn presence",
    timeline: "Ongoing — you may never know it happened",
    preployFit:
      "A polished resume paired with a STAR story bank gives you compelling talking points from the first contact.",
  },
  {
    number: 2,
    title: "Recruiter Screen",
    who: "Internal or agency recruiter",
    signals: "Communication clarity, role fit, motivation, salary alignment",
    timeline: "15-30 min phone or video call",
    preployFit:
      "Behavioral practice sharpens your 60-second pitch and motivation story. Practice before this call.",
  },
  {
    number: 3,
    title: "Technical Screen",
    who: "Engineer or hiring manager",
    signals:
      "Problem-solving, coding fundamentals, communication while coding",
    timeline: "45-60 min — 1-2 problems or a take-home",
    preployFit:
      "Technical sessions simulate this round exactly. Practice thinking aloud and narrating your complexity analysis.",
  },
  {
    number: 4,
    title: "Onsite Loop",
    who: "3-6 interviewers across roles",
    signals:
      "Behavioral competencies, system design depth, coding, culture fit",
    timeline: "Half-day to full-day, often across 2 days for senior roles",
    preployFit:
      "Both behavioral and technical sessions apply here. The loop tests everything — use Preploy to build stamina across multiple rounds.",
  },
  {
    number: 5,
    title: "Debrief",
    who: "Hiring manager + interviewers",
    signals:
      "Aggregate scores, hire/no-hire recommendation, leveling discussion",
    timeline: "1-3 business days after the loop",
    preployFit:
      "You have no direct role here. Your job is done — but the signals you sent in every round feed this decision.",
  },
  {
    number: 6,
    title: "Offer",
    who: "Recruiter and sometimes hiring manager",
    signals: "Compensation, level, start date, negotiation",
    timeline: "Days to weeks depending on headcount approval",
    preployFit:
      "Confidence in the process starts earlier: candidates who practiced tend to negotiate more effectively because they feel they earned the offer.",
  },
];

export default function HiringOverviewPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">How Hiring Works</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Most software engineering hiring funnels follow the same six-stage
          arc. Understanding what happens at each stage — and what signals
          interviewers collect — lets you prepare the right material at the
          right time instead of studying everything at once.
        </p>
      </div>

      <FunnelStepper stages={FUNNEL_STAGES} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Reading the Funnel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed">
          <p>
            You advance by clearing each stage, but the signals from earlier
            stages follow you. A strong recruiter screen creates goodwill the
            hiring manager hears about before the loop. A weak technical screen
            means a harder debrief conversation even if you recover in onsite
            rounds.
          </p>
          <p>
            The debrief is often where leveling decisions happen. Two strong
            coders at the same score can land at different levels if one
            demonstrated clear communication and structured thinking. The rubric
            is never purely technical.
          </p>
          <p>
            Timelines vary — a startup loop might compress all five stages into
            one week; a large company might stretch over two months. Plan your
            prep accordingly: behavioral stories can be prepared months in
            advance; system design and coding patterns benefit from shorter,
            more intensive practice cycles.
          </p>
        </CardContent>
      </Card>

      <Card id="where-preploy-fits">
        <CardHeader>
          <CardTitle className="text-lg">Where Preploy Fits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed">
          <p>
            Behavioral sessions map directly to the recruiter screen and every
            behavioral round in the onsite loop. Technical sessions simulate
            the technical screen and onsite coding rounds. Practice both.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/interview/behavioral/setup" className="flex-1">
              <Button variant="default" className="w-full">
                Start Behavioral Practice
              </Button>
            </Link>
            <Link href="/interview/technical/setup" className="flex-1">
              <Button variant="outline" className="w-full">
                Start Technical Practice
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
