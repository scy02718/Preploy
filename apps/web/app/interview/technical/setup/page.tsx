import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function TechnicalSetupPage() {
  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-2">Technical Interview Setup</h1>
      <p className="text-muted-foreground mb-8">
        Configure your mock technical interview before starting.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Session Configuration</CardTitle>
          <CardDescription>
            Interview type, focus areas, difficulty, and language will be
            configurable here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/interview/technical/session"
            className={buttonVariants()}
          >
            Start Interview
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
