import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function BehavioralSessionPage() {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-3.5rem)] px-4">
      <Badge variant="secondary" className="mb-4">Behavioral Interview</Badge>
      <h1 className="text-2xl font-bold mb-2">Interview Session</h1>
      <p className="text-muted-foreground mb-6 text-center max-w-md">
        The video call layout with your webcam and AI avatar will appear here.
      </p>
      <Button variant="destructive">End Session</Button>
    </div>
  );
}
