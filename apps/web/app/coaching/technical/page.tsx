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

export default function TechnicalPage() {
  return (
    <div className="space-y-8">
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

        <Link href="/interview/technical/setup">
          <Button className="w-full">Practice LeetCode Interview</Button>
        </Link>
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

        <Link href="/interview/technical/setup">
          <Button className="w-full">Practice System Design Interview</Button>
        </Link>
      </div>
    </div>
  );
}
