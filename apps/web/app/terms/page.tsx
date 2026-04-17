{/* DRAFT v1 — written 2026-04-16. Review before launch. Replace with lawyer-drafted or Termly-generated text before collecting real user data or accepting real payments. */}

import type { Metadata } from "next";

// Pure static content — no auth, no DB, no per-user data. Force static
// rendering so it serves from Vercel's edge CDN instead of going through
// a fresh Lambda on every request.
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Terms of Service — Preploy",
  description: "Terms governing your use of the Preploy mock interview practice service.",
  robots: { index: false, follow: false },
};

export default function TermsPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-24">
      <p className="text-sm text-muted-foreground mb-2">Last updated: 2026-04-16</p>
      <h1 className="text-3xl font-bold tracking-tight mb-2">Terms of Service</h1>
      <p className="text-sm text-amber-600 dark:text-amber-400 mb-8 border border-amber-300 dark:border-amber-700 rounded px-3 py-2">
        Draft v1. These terms have not been reviewed by a lawyer. They will be
        replaced with a formally reviewed version before Preploy accepts live
        payments or real user data at scale.
      </p>

      <div className="space-y-8 text-sm leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold mb-3">1. Acceptance of terms</h2>
          <p>
            By creating an account or using the Preploy service (&ldquo;Service&rdquo;), you
            agree to these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree, do
            not use the Service.
          </p>
          <p className="mt-2">
            &ldquo;Preploy&rdquo; refers to the individual operating the service. Questions
            can be sent to{" "}
            <a href="mailto:preploy.dev@gmail.com" className="underline hover:text-foreground">
              preploy.dev@gmail.com
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">2. Account creation</h2>
          <p>
            Accounts are created exclusively through Google OAuth. You must have
            a valid Google account to use Preploy. By signing in, you authorize
            Preploy to receive your name, email, and profile picture from Google.
          </p>
          <p className="mt-2">
            You must be at least 18 years old to create an account and agree to
            these Terms. You are responsible for all activity under your
            account; do not share your account with others.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">3. Acceptable use</h2>
          <p className="mb-3">You agree not to:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Misuse Preploy during a real interview.</strong> Preploy is a practice tool. You may not use it to receive live assistance during an actual job interview, technical assessment, or any other evaluation where outside help is prohibited.</li>
            <li><strong>Scrape or harvest data.</strong> Automated scraping, crawling, or bulk downloading of content from the Service is prohibited.</li>
            <li><strong>Reverse engineer the Service.</strong> You may not decompile, disassemble, or attempt to derive the source code of any part of Preploy.</li>
            <li><strong>Build a competing product.</strong> You may not use outputs from Preploy — including AI-generated questions, feedback, or analysis — to build a product or service that competes with Preploy.</li>
            <li><strong>Violate laws.</strong> You may not use the Service for any unlawful purpose or in violation of any applicable laws or regulations.</li>
            <li><strong>Abuse the infrastructure.</strong> You may not attempt to overwhelm, probe, or exploit the Service&rsquo;s infrastructure.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">4. Free plan</h2>
          <p>
            The free plan allows up to 3 practice interview sessions per
            calendar month. This limit is subject to change with reasonable
            notice. Creating multiple accounts to circumvent limits is a
            violation of these Terms. We reserve the right to apply fair-use
            policies to accounts that appear to be misusing the Service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">5. Pro plan</h2>
          <p>
            The Pro plan is billed monthly through Stripe. Your subscription
            automatically renews at the end of each billing period unless you
            cancel beforehand. You can view your current plan and cancel your
            subscription at any time via the Billing card on your{" "}
            <a href="/profile" className="underline hover:text-foreground">
              profile page
            </a>
            , which opens the Stripe billing portal. Cancellation takes effect
            at the end of the current billing period; you retain access to paid
            features until that date.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">6. Refund policy</h2>
          <p>
            Subscription fees are non-refundable. We do not issue refunds for
            partial months or unused periods. If you cancel mid-cycle, your
            access continues until the end of that billing period — no credit
            is issued for the remaining days.
          </p>
          <p className="mt-2">
            If you believe you were charged in error, contact{" "}
            <a href="mailto:preploy.dev@gmail.com" className="underline hover:text-foreground">
              preploy.dev@gmail.com
            </a>{" "}
            within 14 days and we will investigate.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">7. Your content</h2>
          <p>
            You retain ownership of all content you create using the Service,
            including STAR stories, interview transcripts, resume text, and
            session notes (&ldquo;User Content&rdquo;).
          </p>
          <p className="mt-2">
            By using the Service, you grant Preploy a limited, non-exclusive,
            worldwide license to store, process, and analyze your User Content
            solely to provide the Service to you — for example, to generate AI
            feedback on your answers. This license does not permit us to sell
            your content or share it with third parties beyond the processors
            described in our Privacy Policy.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">8. AI feedback disclaimer</h2>
          <p>
            Preploy generates feedback using large language models. This
            feedback is provided for <strong>practice purposes only</strong>.
            It is not career advice, not a guarantee of interview success, and
            not a substitute for feedback from a human interviewer, mentor, or
            coach. AI-generated feedback may contain errors, omissions, or
            biases.
          </p>
          <p className="mt-2">
            Decisions you make based on Preploy&rsquo;s feedback are entirely your
            responsibility.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">9. Warranty disclaimer</h2>
          <p>
            The Service is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without
            warranties of any kind, express or implied. Preploy does not warrant
            that the Service will be uninterrupted, error-free, or free of
            harmful components, or that any defects will be corrected.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">10. Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, Preploy shall not be liable
            for any indirect, incidental, special, consequential, or punitive
            damages, or any loss of profits, revenues, data, or business
            opportunities, arising out of or related to your use of the Service.
          </p>
          <p className="mt-2">
            Preploy&rsquo;s total cumulative liability to you shall not exceed the
            amount you paid to Preploy in the 12 months preceding the claim, or
            USD $100, whichever is greater.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">11. Termination</h2>
          <p>
            You may terminate your account at any time via the profile page. We
            may terminate or suspend your account if you violate these Terms,
            abuse the Service, or for any reason we determine in good faith,
            with reasonable notice where practical. On termination, your data
            is deleted in accordance with our Privacy Policy.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">12. Governing law</h2>
          <p>
            These Terms are governed by the laws of{" "}
            <strong>[JURISDICTION — fill in your state or country of residence]</strong>
            , without regard to conflict-of-laws principles. Any dispute arising
            out of these Terms shall be resolved in the courts of that
            jurisdiction.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">13. Changes to these terms</h2>
          <p>
            We may update these Terms from time to time. Material changes will
            be announced on the service and take effect 14 days after the
            updated Terms are posted. Your continued use of the Service after
            that date means you accept the revised Terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">14. Contact</h2>
          <p>
            For any question about these Terms, email{" "}
            <a href="mailto:preploy.dev@gmail.com" className="underline hover:text-foreground">
              preploy.dev@gmail.com
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
