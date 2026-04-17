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
    </div>
  );
}
