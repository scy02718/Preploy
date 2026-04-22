import { getBehavioralPersona } from "@/lib/personas";

interface PracticedWithBadgeProps {
  personaId?: string | null;
}

/**
 * Small chip rendered under the feedback h1 when a non-default behavioral
 * persona was used for the session. Returns null for the default persona,
 * unknown ids, or no persona at all — defensively safe.
 */
export function PracticedWithBadge({ personaId }: PracticedWithBadgeProps) {
  if (!personaId || personaId === "default") return null;
  const persona = getBehavioralPersona(personaId);
  if (!persona) return null;

  return (
    <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary">
      Practiced with: {persona.label}
    </span>
  );
}
