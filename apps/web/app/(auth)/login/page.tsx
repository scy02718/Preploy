import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)] px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <CardDescription>
            Sign in to access your interview sessions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" size="lg">
            Sign in with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
