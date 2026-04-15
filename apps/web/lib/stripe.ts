/**
 * Stripe singleton client.
 *
 * Exposed as a Proxy so the underlying Stripe SDK is only constructed on
 * first runtime access. This matters because Next.js evaluates every route
 * module during `next build`'s "Collecting page data" phase — if the client
 * were instantiated at module load, a missing STRIPE_SECRET_KEY would break
 * the build even when the env var is correctly set in the deploy target's
 * runtime environment.
 *
 * Import `stripe` anywhere server-side; never expose it to client bundles.
 * Integration tests can still mock the whole module via
 * `vi.mock("@/lib/stripe", () => ({ stripe: { ... } }))` — the Proxy is
 * replaced wholesale by the mock and is never accessed.
 */
import Stripe from "stripe";

let cached: Stripe | null = null;

function getStripeClient(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  cached = new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
  return cached;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    return Reflect.get(getStripeClient(), prop, receiver);
  },
});
