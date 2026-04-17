import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ComingSoonProps {
  title: string;
  issue: string;
}

export function ComingSoon({ title, issue }: ComingSoonProps) {
  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>Coming soon — check back shortly.</p>
        <p className="text-xs">
          Tracked in{" "}
          <a
            href={`https://github.com/scy02718/interview-assistant/issues/${issue.replace("#", "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            {issue}
          </a>
          .
        </p>
      </CardContent>
    </Card>
  );
}
