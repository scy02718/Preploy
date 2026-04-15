import { Mic, BarChart2, RefreshCw } from "lucide-react";

const steps = [
  {
    icon: Mic,
    title: "Pick your interview",
    description:
      "Choose behavioral or technical, set the company and role, and Preploy generates questions matched to your target job.",
  },
  {
    icon: BarChart2,
    title: "Talk it through",
    description:
      "Speak your answers out loud to a 3D AI interviewer. For technical rounds, write code in the built-in editor while explaining your thinking.",
  },
  {
    icon: RefreshCw,
    title: "Get scored feedback",
    description:
      "Review a detailed breakdown of every answer — what landed, what to cut, and a 0–10 score you can track session over session.",
  },
];

export function LandingHowItWorks() {
  return (
    <section id="how-it-works" className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12">How it works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={index} className="flex flex-col items-center text-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <Icon className="h-7 w-7 text-primary" />
                </div>
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
                  {index + 1}
                </div>
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
