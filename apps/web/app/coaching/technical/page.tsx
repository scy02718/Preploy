"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChooseYourLineWidget } from "@/components/coaching/ChooseYourLineWidget";
import type { ChoiceItem } from "@/components/coaching/ChooseYourLineWidget";
import { usePrefillStore } from "@/stores/prefillStore";
import { useRouter } from "next/navigation";
import type { TechnicalInterviewType } from "@interview-assistant/shared";

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

const CHOOSE_YOUR_LINE_SCENARIO =
  "You just finished implementing a brute-force solution and noticed the interviewer raising an eyebrow. What do you say next?";

const CHOOSE_YOUR_LINE_CHOICES: ChoiceItem[] = [
  {
    line: "Okay, moving on to the next problem.",
    feedback:
      "This signals you don't recognise the issue or aren't comfortable iterating. Interviewers want to see how you respond to implicit feedback.",
    ideal: false,
  },
  {
    line: "I think this works — do you have any questions?",
    feedback:
      "Deflecting to the interviewer when you've spotted a potential issue reads as defensive. It misses a chance to demonstrate proactive problem-solving.",
    ideal: false,
  },
  {
    line: "I realise this is O(n²). Let me think about how to optimise using a hash map.",
    feedback:
      "This is the ideal response. You name the complexity, acknowledge the trade-off, and propose a concrete next step. This is exactly what interviewers grade for: recognising inefficiency and communicating clearly about it.",
    ideal: true,
  },
  {
    line: "Silent continued coding.",
    feedback:
      "Silence after an implicit cue is a red flag. The interviewer needs to see your thought process — narrate out loud, even if you're still thinking.",
    ideal: false,
  },
];

function PracticeButton({
  label,
  interviewType,
}: {
  label: string;
  interviewType: TechnicalInterviewType;
}) {
  const setTechnicalPrefill = usePrefillStore((s) => s.setTechnicalPrefill);
  const router = useRouter();

  function handleClick() {
    setTechnicalPrefill({ interview_type: interviewType });
    router.push("/interview/technical/setup");
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      data-testid={`practice-${interviewType}`}
    >
      {label}
    </Button>
  );
}

export default function TechnicalPage() {
  return (
    <div className="space-y-8">
      {/* ---- Interviewer Rubric ---- */}
      <Section title="What Interviewers Grade For">
        <p>
          Across all technical formats, interviewers evaluate the same core
          dimensions. Understanding them helps you know where to invest your
          preparation time.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            { label: "Correctness", desc: "Does your solution produce the right output for all cases, including edge cases?" },
            { label: "Complexity", desc: "Can you state time and space complexity and justify trade-offs?" },
            { label: "Communication", desc: "Do you narrate your reasoning? Silence is a red flag in every format." },
            { label: "Debugging discipline", desc: "When you hit a bug, do you trace methodically or thrash randomly?" },
            { label: "Edge cases", desc: "Do you proactively ask about or test empty inputs, large values, duplicates?" },
            { label: "Taking hints gracefully", desc: "When the interviewer nudges you, do you incorporate it smoothly?" },
          ].map(({ label, desc }) => (
            <div key={label} className="rounded-md border p-3">
              <p className="font-semibold text-primary">{label}</p>
              <p className="text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ---- Live Coding Dos & Don'ts ---- */}
      <Section title="Live Coding Dos and Don'ts">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 font-medium text-green-700 dark:text-green-400">Do</p>
            <div className="space-y-2">
              <Tip>Think aloud the entire time — describe what you&apos;re considering, not just what you&apos;re doing.</Tip>
              <Tip>Ask clarifying questions before writing a single line: constraints, expected input size, edge cases.</Tip>
              <Tip>Narrate your complexity analysis as you write, not just at the end.</Tip>
              <Tip>Ask the interviewer before optimising: &quot;Should I optimise for time or space here?&quot;</Tip>
            </div>
          </div>
          <div>
            <p className="mb-2 font-medium text-red-700 dark:text-red-400">Don&apos;t</p>
            <div className="space-y-2">
              <Tip>Don&apos;t code in silence. Even &quot;I&apos;m thinking...&quot; is better than no signal at all.</Tip>
              <Tip>Don&apos;t jump straight into optimising before you have a working solution.</Tip>
              <Tip>Don&apos;t assume your first attempt is perfect — trace through it with an example before declaring done.</Tip>
              <Tip>Don&apos;t ignore the interviewer&apos;s hints. If they say &quot;interesting, is there a faster way?&quot; — explore it.</Tip>
            </div>
          </div>
        </div>
      </Section>

      {/* ---- Choose Your Line Widget ---- */}
      <Section title="Choose Your Next Line">
        <p>
          Practice your instinct for reading the room. Select the response you
          would give and see how interviewers interpret it.
        </p>
        <ChooseYourLineWidget
          scenario={CHOOSE_YOUR_LINE_SCENARIO}
          choices={CHOOSE_YOUR_LINE_CHOICES}
        />
      </Section>

      {/* ---- LeetCode / Coding section ---- */}
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">LeetCode / Coding Interviews</h2>

        <Section title="Problem-Solving Framework">
          <p>Follow this 4-step approach for every coding problem:</p>
          <div className="space-y-3">
            {[
              { step: "1. Understand", desc: "Read the problem twice. Clarify constraints. Walk through examples. Ask: what are the edge cases?" },
              { step: "2. Plan", desc: "Discuss your approach BEFORE coding. Mention brute force first, then optimize. State the time/space complexity." },
              { step: "3. Implement", desc: "Write clean code. Use meaningful variable names. Talk through what you're writing." },
              { step: "4. Verify", desc: "Trace through your code with an example. Check edge cases. Fix bugs before the interviewer points them out." },
            ].map(({ step, desc }) => (
              <div key={step} className="rounded-md border p-3">
                <p className="font-semibold text-primary">{step}</p>
                <p className="text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Common Patterns">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              { pattern: "Two Pointers", when: "Sorted arrays, palindromes, pair finding" },
              { pattern: "Sliding Window", when: "Subarrays, substrings with constraints" },
              { pattern: "BFS / DFS", when: "Trees, graphs, connected components" },
              { pattern: "Dynamic Programming", when: "Optimization, counting paths, subsequences" },
              { pattern: "Hash Map", when: "Frequency counting, two-sum style lookups" },
              { pattern: "Binary Search", when: "Sorted data, finding boundaries, min/max optimization" },
              { pattern: "Stack / Queue", when: "Matching brackets, monotonic sequences, BFS" },
              { pattern: "Recursion + Backtracking", when: "Permutations, combinations, constraint satisfaction" },
            ].map(({ pattern, when }) => (
              <div key={pattern} className="rounded-md border p-3">
                <p className="font-medium">{pattern}</p>
                <p className="text-xs text-muted-foreground">When: {when}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="LeetCode Tips for Success">
          <div className="space-y-2">
            <Tip>Think aloud the entire time. Silence is the biggest red flag in a coding interview.</Tip>
            <Tip>Always discuss complexity. State time and space complexity before and after optimization.</Tip>
            <Tip>Start with brute force if stuck — a working O(n^2) beats an incomplete O(n).</Tip>
            <Tip>Test your code with the given examples AND at least one edge case (empty input, single element, etc.).</Tip>
            <Tip>Practice writing code without autocomplete. In interviews, you won&apos;t have an IDE.</Tip>
          </div>
        </Section>

        <PracticeButton label="Practice LeetCode Interview" interviewType="leetcode" />
      </div>

      {/* ---- System Design section ---- */}
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">System Design Interviews</h2>

        <Section title="System Design Framework">
          <p>
            System design interviews test how you think about building large-scale
            systems. Follow this structure:
          </p>
          <div className="space-y-3">
            {[
              { step: "1. Requirements", desc: "Clarify functional and non-functional requirements. Ask about scale, latency, consistency. Don't assume." },
              { step: "2. High-Level Design", desc: "Draw the main components: clients, servers, databases, caches. Show how data flows through the system." },
              { step: "3. Deep Dive", desc: "Pick 2-3 components to design in detail. The interviewer will often guide you here. Show you understand trade-offs." },
              { step: "4. Trade-offs", desc: "Discuss what you'd change at 10x scale. Mention alternatives you considered and why you chose this approach." },
            ].map(({ step, desc }) => (
              <div key={step} className="rounded-md border p-3">
                <p className="font-semibold text-primary">{step}</p>
                <p className="text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Key Concepts to Know">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              { concept: "Load Balancing", desc: "Distribute traffic across servers (round-robin, consistent hashing)" },
              { concept: "Caching", desc: "Redis/Memcached, cache invalidation strategies, CDN" },
              { concept: "Database Design", desc: "SQL vs NoSQL, sharding, replication, indexing" },
              { concept: "Message Queues", desc: "Kafka, RabbitMQ — decouple producers and consumers" },
              { concept: "Microservices", desc: "Service boundaries, API gateways, service discovery" },
              { concept: "CAP Theorem", desc: "Consistency, Availability, Partition tolerance — pick two" },
            ].map(({ concept, desc }) => (
              <div key={concept} className="rounded-md border p-3">
                <p className="font-medium">{concept}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="System Design Tips for Success">
          <div className="space-y-2">
            <Tip>Always start by asking clarifying questions. &quot;How many users?&quot; &quot;What&apos;s the read/write ratio?&quot; &quot;What&apos;s the latency requirement?&quot;</Tip>
            <Tip>Use back-of-the-envelope calculations. &quot;100M users, 10 requests/day = 1B requests/day = ~12K QPS.&quot;</Tip>
            <Tip>There&apos;s no single right answer. What matters is your reasoning process and awareness of trade-offs.</Tip>
            <Tip>Draw diagrams. Even in a voice interview, describe the diagram you&apos;d draw. &quot;I&apos;d have a client talking to an API gateway, which routes to...&quot;</Tip>
          </div>
        </Section>

        <PracticeButton label="Practice System Design Interview" interviewType="system_design" />
      </div>

      {/* ---- Frontend section ---- */}
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Frontend Interviews</h2>

        <Section title="What Frontend Interviews Cover">
          <p>
            Frontend interviews blend coding challenges with product thinking. You
            should expect a mix of the following:
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              { area: "DOM manipulation", desc: "Building UI components from scratch without a framework, event delegation" },
              { area: "React component design", desc: "Props, state, controlled vs uncontrolled inputs, lifecycle patterns" },
              { area: "CSS & layout", desc: "Flexbox, grid, responsive breakpoints, specificity" },
              { area: "Accessibility", desc: "ARIA roles, keyboard navigation, screen-reader compatibility" },
              { area: "Performance", desc: "Bundle size, rendering bottlenecks, lazy loading, memoization" },
              { area: "Browser APIs", desc: "Fetch, Web Storage, History API, Intersection Observer" },
            ].map(({ area, desc }) => (
              <div key={area} className="rounded-md border p-3">
                <p className="font-medium">{area}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Frontend Tips">
          <div className="space-y-2">
            <Tip>When building a component, state your assumptions about the environment (vanilla JS vs React?) before writing.</Tip>
            <Tip>Show you think about edge states: empty, loading, error, and the happy path.</Tip>
            <Tip>Accessibility questions test whether you treat it as a checkbox or a genuine priority — mention it proactively.</Tip>
          </div>
        </Section>

        <PracticeButton label="Practice Frontend Interview" interviewType="frontend" />
      </div>

      {/* ---- Backend section ---- */}
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Backend Interviews</h2>

        <Section title="What Backend Interviews Cover">
          <p>
            Backend interviews focus on API design, data modeling, and the
            reasoning behind architectural decisions:
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              { area: "API design", desc: "REST vs GraphQL, versioning, idempotency, error contracts" },
              { area: "Database schema", desc: "Normalisation, indexes, query optimisation, migrations" },
              { area: "Scaling & rate limiting", desc: "Horizontal vs vertical scaling, token bucket, leaky bucket" },
              { area: "Auth", desc: "JWT, sessions, OAuth flows, password hashing" },
              { area: "Debugging walkthroughs", desc: "Given a production incident description, trace the likely root cause" },
              { area: "Concurrency", desc: "Race conditions, locks, optimistic vs pessimistic locking" },
            ].map(({ area, desc }) => (
              <div key={area} className="rounded-md border p-3">
                <p className="font-medium">{area}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Backend Tips">
          <div className="space-y-2">
            <Tip>When asked to design an API, state the happy path first, then walk through failure modes.</Tip>
            <Tip>For schema questions, sketch the entities and their cardinality before writing SQL.</Tip>
            <Tip>Debugging questions reward methodical thinking over lucky guesses — state your hypothesis, the evidence you&apos;d look for, and your next action.</Tip>
          </div>
        </Section>

        <PracticeButton label="Practice Backend Interview" interviewType="backend" />
      </div>

      {/* All-formats practice CTA */}
      <Card>
        <CardContent className="pt-4">
          <p className="mb-3 text-sm text-muted-foreground">
            Want to practice a specific format? Start a session pre-configured
            for any of the four technical interview types.
          </p>
          <Link href="/interview/technical/setup">
            <Button className="w-full">Browse All Technical Formats</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
