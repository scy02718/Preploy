"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

function BehavioralTab() {
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

function LeetCodeTab() {
  return (
    <div className="space-y-6">
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

      <Section title="Tips for Success">
        <div className="space-y-2">
          <Tip>Think aloud the entire time. Silence is the biggest red flag in a coding interview.</Tip>
          <Tip>Always discuss complexity. State time and space complexity before and after optimization.</Tip>
          <Tip>Start with brute force if stuck — a working O(n^2) beats an incomplete O(n).</Tip>
          <Tip>Test your code with the given examples AND at least one edge case (empty input, single element, etc.).</Tip>
          <Tip>Practice writing code without autocomplete. In interviews, you won&apos;t have an IDE.</Tip>
        </div>
      </Section>

      <Link href="/interview/technical/setup">
        <Button className="w-full">Practice LeetCode Interview</Button>
      </Link>
    </div>
  );
}

function SystemDesignTab() {
  return (
    <div className="space-y-6">
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

      <Section title="Tips for Success">
        <div className="space-y-2">
          <Tip>Always start by asking clarifying questions. &quot;How many users?&quot; &quot;What&apos;s the read/write ratio?&quot; &quot;What&apos;s the latency requirement?&quot;</Tip>
          <Tip>Use back-of-the-envelope calculations. &quot;100M users, 10 requests/day = 1B requests/day = ~12K QPS.&quot;</Tip>
          <Tip>There&apos;s no single right answer. What matters is your reasoning process and awareness of trade-offs.</Tip>
          <Tip>Draw diagrams. Even in a voice interview, describe the diagram you&apos;d draw. &quot;I&apos;d have a client talking to an API gateway, which routes to...&quot;</Tip>
        </div>
      </Section>

      <Link href="/interview/technical/setup">
        <Button className="w-full">Practice System Design Interview</Button>
      </Link>
    </div>
  );
}

function CommunicationTab() {
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

export default function CoachingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">Interview Coaching</h1>
      <p className="mb-8 text-muted-foreground">
        Learn proven techniques and frameworks to ace your interviews. Pick a
        topic and practice.
      </p>

      <Tabs defaultValue="behavioral">
        <TabsList className="mb-6 w-full justify-start">
          <TabsTrigger value="behavioral">Behavioral</TabsTrigger>
          <TabsTrigger value="leetcode">LeetCode</TabsTrigger>
          <TabsTrigger value="system-design">System Design</TabsTrigger>
          <TabsTrigger value="communication">Communication</TabsTrigger>
        </TabsList>

        <TabsContent value="behavioral">
          <BehavioralTab />
        </TabsContent>
        <TabsContent value="leetcode">
          <LeetCodeTab />
        </TabsContent>
        <TabsContent value="system-design">
          <SystemDesignTab />
        </TabsContent>
        <TabsContent value="communication">
          <CommunicationTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
