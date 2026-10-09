import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { SiteLayout } from "../components/Layout";

// The terms of service, as a normal site page: a route, its own URL, and a
// footer link, because a legal page a user cannot reach is not a legal page.
// The content matches what the service actually does today, including the
// part where it is still in development -- promising uptime or durability
// here would contradict the announcement the site itself links to.
export default function Terms() {
  return (
    <SiteLayout>
      <article className="py-16 sm:py-20">
        <div className="mx-auto w-full max-w-[720px] px-6">
          <p className="mb-3 text-center text-[0.76rem] font-semibold uppercase tracking-[0.13em] text-accent-strong">
            Legal
          </p>
          <h1 className="mb-3 text-center text-[clamp(1.8rem,3.6vw,2.6rem)] font-semibold tracking-tight">
            Terms of Service
          </h1>
          <p className="mx-auto mb-10 max-w-[46em] text-center text-muted">
            Last updated October 2026. By using moogo.dev you agree to these
            terms. If you do not agree, do not use the service.
          </p>

          <div className="space-y-8 text-[0.92rem] leading-relaxed text-muted">
            <Section title="1. The service">
              Moogo provides a hosted SQLite database and object storage for
              applications. Each project gets its own database file, its own
              keys, and its own storage bucket, reachable over HTTP.
            </Section>

            <Section title="2. Development status">
              Moogo is in active development. It is offered for testing and
              evaluation: there is no uptime commitment, no durability
              guarantee, and no warranty of any kind. Do not store data you
              cannot afford to lose, and keep your own copies of anything that
              matters. The{" "}
              <Link to="/announcement" className="text-accent-strong underline underline-offset-4 hover:text-accent">
                announcement page
              </Link>{" "}
              states the current status and will be updated when that changes.
            </Section>

            <Section title="3. Your account">
              You need an account to create projects, either with a password or
              by signing in with Google. You are responsible for keeping your
              credentials safe and for the activity that happens under your
              account. You must be old enough to agree to these terms where you
              live. Tell us at the address below if your account is used without
              your permission.
            </Section>

            <Section title="4. Acceptable use">
              Use the service for lawful purposes. Do not attempt to disrupt or
              gain unauthorised access to the service or other people's
              projects, do not use it to distribute malware or abusive content,
              and do not exceed the published limits by any means. Accounts
              that endanger the service or other users may be suspended.
            </Section>

            <Section title="5. Your data">
              Your databases, objects, and keys belong to you. Moogo processes
              them only to run the service you asked for. The collection and
              handling of account data is described in the{" "}
              <Link to="/privacy" className="text-accent-strong underline underline-offset-4 hover:text-accent">
                privacy policy
              </Link>
              .
            </Section>

            <Section title="6. Changes and availability">
              The service changes as it is built: features may change or be
              removed, and breaking changes are possible. We may limit or stop
              the service, with as much notice as the circumstances allow.
            </Section>

            <Section title="7. Ending your account">
              You can delete your account at any time from{" "}
              <Link to="/app/settings" className="text-accent-strong underline underline-offset-4 hover:text-accent">
                Settings
              </Link>
              . Deletion removes your account, projects, databases, and stored
              objects. We may suspend or end accounts that break these terms.
            </Section>

            <Section title="8. Liability">
              To the fullest extent the law allows, Moogo is not liable for
              damages arising from use of the service, including loss of data
              or interruptions. Nothing here excludes liability that cannot be
              excluded by law.
            </Section>

            <Section title="9. Contact">
              Questions about these terms:{" "}
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
    <section>
      <h2 className="mb-2 text-[1.05rem] font-semibold text-foreground">{title}</h2>
      <div className="max-w-[62ch]">{children}</div>
    </section>
  );
}
