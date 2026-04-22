import { describe, it, expect } from "vitest";
import {
  BEHAVIORAL_PERSONAS,
  getBehavioralPersona,
  isProBehavioralPersona,
  applyProbeStyleCap,
  DEFAULT_BEHAVIORAL_PERSONA_ID,
} from "./personas";

describe("BEHAVIORAL_PERSONAS", () => {
  it("has 5 entries with unique ids", () => {
    expect(BEHAVIORAL_PERSONAS).toHaveLength(5);
    const ids = BEHAVIORAL_PERSONAS.map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(5);
  });

  it("includes the default persona with id 'default'", () => {
    const defaultPersona = BEHAVIORAL_PERSONAS.find(
      (p) => p.id === DEFAULT_BEHAVIORAL_PERSONA_ID
    );
    expect(defaultPersona).toBeDefined();
    expect(defaultPersona?.proOnly).toBe(false);
  });
});

describe("getBehavioralPersona", () => {
  it("returns the Amazon LP record for 'amazon-lp'", () => {
    const p = getBehavioralPersona("amazon-lp");
    expect(p).toBeDefined();
    expect(p?.id).toBe("amazon-lp");
    expect(p?.interviewerName).toBe("Priya");
    expect(p?.proOnly).toBe(true);
  });

  it("returns undefined for an unknown id", () => {
    expect(getBehavioralPersona("bogus")).toBeUndefined();
  });

  it("returns undefined for null", () => {
    expect(getBehavioralPersona(null)).toBeUndefined();
  });

  it("returns undefined for undefined", () => {
    expect(getBehavioralPersona(undefined)).toBeUndefined();
  });

  it("returns the warm-peer record for 'warm-peer'", () => {
    const p = getBehavioralPersona("warm-peer");
    expect(p?.interviewerName).toBe("Jess");
    expect(p?.probeStyle).toBe("gentle");
  });

  it("returns the hostile-panel record for 'hostile-panel'", () => {
    const p = getBehavioralPersona("hostile-panel");
    expect(p?.interviewerName).toBe("Dr. Harlan");
    expect(p?.probeStyle).toBe("aggressive");
  });
});

describe("isProBehavioralPersona", () => {
  it("returns false for 'default'", () => {
    expect(isProBehavioralPersona("default")).toBe(false);
  });

  it("returns true for 'amazon-lp'", () => {
    expect(isProBehavioralPersona("amazon-lp")).toBe(true);
  });

  it("returns true for 'google-star'", () => {
    expect(isProBehavioralPersona("google-star")).toBe(true);
  });

  it("returns true for 'warm-peer'", () => {
    expect(isProBehavioralPersona("warm-peer")).toBe(true);
  });

  it("returns true for 'hostile-panel'", () => {
    expect(isProBehavioralPersona("hostile-panel")).toBe(true);
  });

  it("returns false for unknown id (safe default)", () => {
    expect(isProBehavioralPersona("bogus")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isProBehavioralPersona(null)).toBe(false);
  });
});

describe("applyProbeStyleCap", () => {
  it("gentle caps 3 down to 1", () => {
    expect(applyProbeStyleCap(3, "gentle")).toBe(1);
  });

  it("gentle caps 2 down to 1", () => {
    expect(applyProbeStyleCap(2, "gentle")).toBe(1);
  });

  it("gentle does NOT raise floor: 0 stays 0", () => {
    expect(applyProbeStyleCap(0, "gentle")).toBe(0);
  });

  it("gentle with 1 stays 1 (at the cap)", () => {
    expect(applyProbeStyleCap(1, "gentle")).toBe(1);
  });

  it("neutral is a no-op: 3 stays 3", () => {
    expect(applyProbeStyleCap(3, "neutral")).toBe(3);
  });

  it("neutral is a no-op: 0 stays 0", () => {
    expect(applyProbeStyleCap(0, "neutral")).toBe(0);
  });

  it("aggressive is ceiling-only (no-op as cap): 3 stays 3", () => {
    expect(applyProbeStyleCap(3, "aggressive")).toBe(3);
  });

  it("aggressive does NOT force depth up: 1 stays 1", () => {
    expect(applyProbeStyleCap(1, "aggressive")).toBe(1);
  });

  it("undefined probeStyle is a no-op: 2 stays 2", () => {
    expect(applyProbeStyleCap(2, undefined)).toBe(2);
  });
});
