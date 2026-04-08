import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function BehavioralSetupPage() {
  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-2">Behavioral Interview Setup</h1>
      <p className="text-muted-foreground mb-8">
        Configure your mock behavioral interview before starting.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Session Configuration</CardTitle>
          <CardDescription>
            Company details, expected questions, and interview style will be
            configurable here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/interview/behavioral/session"
            className={buttonVariants()}
          >
            Start Interview
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
