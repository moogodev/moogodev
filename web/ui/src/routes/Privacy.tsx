import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { SiteLayout } from "../components/Layout";

// The privacy policy, paired with Terms.tsx. It describes what the service
// actually collects today -- an address, a name, the project data you create,
// and access logs -- rather than a generic policy copied from elsewhere, so
// each section can be checked against the code that implements it.
export default function Privacy() {
  return (
    <SiteLayout>
      <article className="py-16 sm:py-20">
        <div className="mx-auto w-full max-w-[880px] px-6">
          <p className="mb-3 text-center text-[0.76rem] font-semibold uppercase tracking-[0.13em] text-accent-strong">
            Legal
          </p>
          <h1 className="mb-3 text-center text-[clamp(1.8rem,3.6vw,2.6rem)] font-semibold tracking-tight">
            Privacy Policy
          </h1>
          <p className="mx-auto mb-10 max-w-[46em] text-center text-muted">
            Last updated October 2026. This policy covers moogo.dev: what is
            collected, why, and what happens to it.
          </p>

          <div className="space-y-8 text-[0.92rem] leading-relaxed text-muted">
            <Section title="What is collected">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  <strong className="text-foreground">Account data</strong> — your
                  email address and display name, and whether you signed up with
                  a password or through Google. With Google sign-in, Google
                  shares your address and name under its own permissions.
                </li>
                <li>
                  <strong className="text-foreground">Your content</strong> — the
                  databases, objects, and keys you create. They are stored to
                  provide the service and are never read for any other purpose.
                </li>
                <li>
                  <strong className="text-foreground">Logs</strong> — standard
                  web-server logs including the client address the proxy
                  reports, the time, and the path requested. They are used to
                  operate and secure the service, including rate limiting.
                </li>
              </ul>
            </Section>

            <Section title="Cookies">
              Moogo uses one session cookie to keep you signed in. It holds no
              tracking identifier and is sent only to moogo.dev. There are no
              advertising or third-party analytics cookies.
            </Section>

            <Section title="What is not done">
              Personal data is not sold, rented, or shared for advertising.
              There is no advertising on the service and no third-party
              analytics on this site.
            </Section>

            <Section title="Retention and deletion">
              Account data is kept while your account exists. Deleting your
              account from{" "}
              <Link to="/app/settings" className="text-accent-strong underline underline-offset-4 hover:text-accent">
                Settings
              </Link>{" "}
              removes the account, its projects, databases, and stored objects.
              Server logs are rotated by the operating system and are not kept
              indefinitely.
            </Section>

            <Section title="Processors">
              The site is delivered through a reverse proxy and tunnel on the
              hosting server, and email is sent through the configured mail
              provider to deliver verification links and notices. Only what is
              needed for each step leaves the service.
            </Section>

            <Section title="Changes">
              This policy changes only with the service. The date at the top
              moves when it does.
            </Section>

            <Section title="Contact">
              Questions about your data:{" "}
              <a
                href="mailto:moogo.dev@gmail.com"
                className="text-accent-strong underline underline-offset-4 hover:text-accent"
              >
                moogo.dev@gmail.com
              </a>
              .
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
