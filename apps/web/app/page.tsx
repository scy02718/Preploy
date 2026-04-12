import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Code } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-4">
      <div className="flex flex-col items-center mb-12">
        <img src="/logo.svg" alt="Preploy" className="h-16 w-16 mb-4" />
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          Preploy
        </h1>
        <p className="text-lg text-muted-foreground max-w-lg">
          Practice mock interviews with AI and get detailed feedback to improve
          your performance.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl w-full">
        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Behavioral Interview</CardTitle>
            </div>
            <CardDescription>
              Voice-to-voice mock interview with a 3D AI interviewer. Get
              feedback on your STAR responses, communication, and confidence.
            </CardDescription>
            <Link
              href="/interview/behavioral/setup"
              className={buttonVariants({ className: "mt-4 w-full" })}
            >
              Start Behavioral Interview
            </Link>
          </CardHeader>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Code className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Technical Interview</CardTitle>
            </div>
            <CardDescription>
              Solve coding problems while explaining your thought process. Get
              feedback on code quality and communication.
            </CardDescription>
            <Link
              href="/interview/technical/setup"
              className={buttonVariants({ className: "mt-4 w-full" })}
            >
              Start Technical Interview
            </Link>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
