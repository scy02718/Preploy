import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function TechnicalSessionPage() {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-3.5rem)] px-4">
      <Badge variant="secondary" className="mb-4">Technical Interview</Badge>
      <h1 className="text-2xl font-bold mb-2">Coding Session</h1>
      <p className="text-muted-foreground mb-6 text-center max-w-md">
        The Monaco code editor with problem description and output panel will
        appear here.
      </p>
      <Button variant="destructive">End Session</Button>
    </div>
  );
}
