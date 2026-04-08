import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <p className="text-muted-foreground mb-8">
        View your interview history and track your progress.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">0</CardTitle>
            <CardDescription>Total Sessions</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">--</CardTitle>
            <CardDescription>Average Score</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">0</CardTitle>
            <CardDescription>This Week</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
