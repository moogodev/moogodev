import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { SiteLayout } from "../components/Layout";

// The Contact page: one address for everything, plus the channels that must
// not be the address — public bugs on GitHub, security reports privately,
// posts on daily.dev. The wording matches the announcement page's contact
// card, so the two pages never promise different things about replies.
export default function Contact() {
  return (
    <SiteLayout>
      <article className="py-16 sm:py-20">
        <div className="mx-auto w-full max-w-[880px] px-6">
          <p className="mb-3 text-center text-[0.76rem] font-semibold uppercase tracking-[0.13em] text-accent-strong">
            Contact
          </p>
          <h1 className="mb-3 text-center text-[clamp(1.8rem,3.6vw,2.6rem)] font-semibold tracking-tight">
            Contact
          </h1>
          <p className="mx-auto mb-10 max-w-[46em] text-center text-muted">
            Questions, feedback, bug reports, or offers to help — send them all
            to the address below. Every message gets a reply.
          </p>

          <div className="mb-10 text-center">
            <a
              href="mailto:moogo.dev@gmail.com"
              className="inline-flex items-center justify-center rounded-lg bg-accent-strong px-5 py-2.5 font-semibold text-accent-ink transition-colors hover:bg-accent"
            >
              moogo.dev@gmail.com
            </a>
          </div>

          <div className="space-y-8 text-[0.92rem] leading-relaxed text-muted">
            <Section title="Bug reports and feature requests">
              Public bugs belong on GitHub, where the discussion is visible to
              everyone with the same problem:{" "}
              <a
                href="https://github.com/moogodev/moogodev/issues/new/choose"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-strong underline underline-offset-4 hover:text-accent"
              >
                open an issue
              </a>
              . Include what you did, what you expected, and what happened
              instead — the{" "}
              <Link to="/docs/feedback" className="text-accent-strong underline underline-offset-4 hover:text-accent">
                feedback page
              </Link>{" "}
              says what makes a report actionable.
            </Section>

            <Section title="Security">
              Report security problems privately, never in a public issue: use
              the{" "}
              <a
                href="https://github.com/moogodev/moogodev/security/policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-strong underline underline-offset-4 hover:text-accent"
              >
                security policy
              </a>{" "}
              or email the address above with the word "security" in the
              subject. The{" "}
              <Link to="/docs/security" className="text-accent-strong underline underline-offset-4 hover:text-accent">
                security page
              </Link>{" "}
              describes the threat model the service is built against.
            </Section>

            <Section title="Everything else">
              Account trouble, questions about the API, partnership or
              sponsorship offers — all of it goes to{" "}
              <a
                href="mailto:moogo.dev@gmail.com"
                className="text-accent-strong underline underline-offset-4 hover:text-accent"
              >
                moogo.dev@gmail.com
              </a>
              . For a quick orientation before writing,{" "}
              <Link to="/docs/quickstart" className="text-accent-strong underline underline-offset-4 hover:text-accent">
                the quickstart
              </Link>{" "}
              and the{" "}
              <Link to="/about" className="text-accent-strong underline underline-offset-4 hover:text-accent">
                about page
              </Link>{" "}
              cover what the service is.
            </Section>

            <Section title="Elsewhere">
              Releases, guides and announcements are posted to{" "}
              <a
                href="https://daily.dev/moogodev"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-strong underline underline-offset-4 hover:text-accent"
              >
                daily.dev
              </a>{" "}
              — follow the profile there to read new posts in your feed.
            </Section>
          </div>
        </div>
      </article>
    </SiteLayout>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    // The section is one centered block so heading and prose share a left
    // edge with balanced space on both sides: left-aligned inside a wider
    // container, the column used to sit visibly left of center.
    <section className="mx-auto max-w-[68ch]">
      <h2 className="mb-2 text-[1.05rem] font-semibold text-foreground">{title}</h2>
      <div>{children}</div>
    </section>
  );
}
