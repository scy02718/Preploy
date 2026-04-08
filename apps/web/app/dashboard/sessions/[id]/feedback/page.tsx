import { Badge } from "@/components/ui/badge";

export default async function FeedbackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">Session Feedback</h1>
        <Badge variant="secondary">Session {id}</Badge>
      </div>
      <p className="text-muted-foreground">
        Feedback and analytics will appear here after completing an interview
        session.
      </p>
    </div>
  );
}
