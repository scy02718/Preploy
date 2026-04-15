import { Card, CardContent } from "@/components/ui/card";
import { Mic, Code, FileText, BarChart2, CalendarDays, Award } from "lucide-react";

const features = [
  {
    icon: Mic,
    title: "Voice mock interviews",
    description:
      "Speak to a 3D AI interviewer and get transcribed answers scored on content, structure, and delivery.",
  },
  {
    icon: Code,
    title: "Live code editor",
    description:
      "Solve algorithm problems in a real editor with syntax highlighting while explaining your approach out loud.",
  },
  {
    icon: FileText,
    title: "Resume-based questions",
    description:
      "Upload your resume and generate targeted behavioral or technical questions drawn from your actual experience.",
  },
  {
    icon: BarChart2,
    title: "Scored answer feedback",
    description:
      "Every answer receives a 0–10 score with a breakdown of strengths, gaps, and a suggested improvement.",
  },
  {
    icon: CalendarDays,
    title: "Day-by-day prep plan",
    description:
      "Enter your interview date and role; Preploy builds a structured practice schedule leading up to the day.",
  },
  {
    icon: Award,
    title: "Progress badges",
    description:
      "Earn badges for completing your first interview, hitting score milestones, and maintaining a daily practice streak.",
  },
];

export function LandingFeatures() {
  return (
    <section className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-4">What you get</h2>
        <p className="text-muted-foreground text-center mb-12 max-w-xl mx-auto">
          Every feature below is live in the app today — nothing on this page is a roadmap item.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index} className="hover:border-primary/40 transition-colors">
                <CardContent className="pt-6 flex flex-col gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
