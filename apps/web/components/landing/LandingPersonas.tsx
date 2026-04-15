import { Card, CardContent } from "@/components/ui/card";
import { GraduationCap, RefreshCw, Laptop } from "lucide-react";

const personas = [
  {
    icon: GraduationCap,
    title: "New graduate",
    pain: "You have internship experience but freeze when asked to walk through it live.",
    outcome: "Preploy drills STAR answers until you can tell each story in under two minutes, without rambling.",
  },
  {
    icon: RefreshCw,
    title: "Career switcher",
    pain: "You are applying to a field where you lack the usual credentials, and every interview feels like you are starting from zero.",
    outcome: "Resume-based question generation surfaces the transferable skills you already have, framed for the role you want.",
  },
  {
    icon: Laptop,
    title: "Returning to tech",
    pain: "You have been out of engineering for a while and are not sure your coding muscle memory is still there.",
    outcome: "Technical mock interviews with a live code editor let you rebuild that muscle privately, on your schedule.",
  },
];

export function LandingPersonas() {
  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-4">Who this is for</h2>
        <p className="text-muted-foreground text-center mb-12 max-w-xl mx-auto">
          Preploy is built for people who want real practice, not another list of tips.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {personas.map((persona, index) => {
            const Icon = persona.icon;
            return (
              <Card key={index} className="border-0 bg-background">
                <CardContent className="pt-6 flex flex-col gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg">{persona.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    <span className="font-medium text-foreground">The problem:</span>{" "}
                    {persona.pain}
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    <span className="font-medium text-foreground">The outcome:</span>{" "}
                    {persona.outcome}
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
