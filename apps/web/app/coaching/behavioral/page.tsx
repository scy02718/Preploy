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

export default function BehavioralPage() {
  return (
    <div className="space-y-6">
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

      <Section title="Common Question Categories">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[
            { category: "Leadership", example: "Tell me about a time you led a team through a difficult project" },
            { category: "Conflict", example: "Describe a disagreement with a colleague and how you resolved it" },
            { category: "Failure", example: "Tell me about a time you failed and what you learned" },
            { category: "Teamwork", example: "Give an example of a successful collaboration" },
            { category: "Initiative", example: "Describe a time you went above and beyond" },
            { category: "Adaptability", example: "Tell me about a time you had to change your approach" },
          ].map(({ category, example }) => (
            <div key={category} className="rounded-md border p-3">
              <p className="font-medium">{category}</p>
              <p className="text-xs text-muted-foreground">{example}</p>
            </div>
          ))}
        </div>
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
