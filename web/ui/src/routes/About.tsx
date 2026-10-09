import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { SiteLayout } from "../components/Layout";

// The About page the footer's Product column links to: the long form of the
// footer's one-line description. Every claim here mirrors something the docs
// or the code already says — what the limits are, what phase the service is
// in — so the page cannot grow into promises the service does not keep.
export default function About() {
  return (
    <SiteLayout>
      <article className="py-16 sm:py-20">
        <div className="mx-auto w-full max-w-[720px] px-6">
          <p className="mb-3 text-center text-[0.76rem] font-semibold uppercase tracking-[0.13em] text-accent-strong">
            About
          </p>
          <h1 className="mb-3 text-center text-[clamp(1.8rem,3.6vw,2.6rem)] font-semibold tracking-tight">
            About Moogo
          </h1>
          <p className="mx-auto mb-10 max-w-[46em] text-center text-muted">
            A hosted SQLite database and object storage for each project,
            reached over plain HTTP. No connection string, no driver — SQL
            travels as JSON in a POST request, and files travel as raw request
            bodies.
          </p>

          <div className="space-y-8 text-[0.92rem] leading-relaxed text-muted">
            <Section title="The product">
              Every project you create gets its own SQLite file, its own object
              storage bucket, and its own keys — isolated from every other
              project on the account. The database is reached with two
              endpoints, <code className="font-mono text-foreground">/query</code>{" "}
              for reads and{" "}
              <code className="font-mono text-foreground">/exec</code> for writes,
              and the bucket with plain{" "}
              <code className="font-mono text-foreground">POST</code>,{" "}
              <code className="font-mono text-foreground">GET</code> and{" "}
              <code className="font-mono text-foreground">DELETE</code> on an
              object's key. A dashboard on the same origin lets you browse
              tables, run queries by hand, and download backups.{" "}
              <Link to="/docs/quickstart" className="text-accent-strong underline underline-offset-4 hover:text-accent">
                The quickstart
              </Link>{" "}
              takes an account to a first query in about two minutes.
            </Section>

            <Section title="Why it exists">
              Serverless and edge applications cannot hold a traditional
              database connection: there is no long-lived process to keep one
              open, and a connection string is a credential the deployment has
              to carry anyway. SQLite has no server to connect to — it is a
              file — so Moogo wraps one file per project in a small HTTP API
              and lets the application speak SQL the way it already speaks
              everything else: over a request. The{" "}
              <Link to="/docs/why-moogo" className="text-accent-strong underline underline-offset-4 hover:text-accent">
                why Moogo
              </Link>{" "}
              page argues the trade-offs in full.
            </Section>

            <Section title="Status">
              Moogo is in active development. It is usable for testing and
              evaluation, and it is not ready for production: there is no
              uptime commitment and no durability guarantee yet. The{" "}
              <Link to="/announcement" className="text-accent-strong underline underline-offset-4 hover:text-accent">
                announcement page
              </Link>{" "}
              carries the current status, the{" "}
              <Link to="/docs/limits" className="text-accent-strong underline underline-offset-4 hover:text-accent">
                limits page
              </Link>{" "}
              states exactly what is and is not capped, and the{" "}
              <Link to="/plan" className="text-accent-strong underline underline-offset-4 hover:text-accent">
                pricing page
              </Link>{" "}
              explains what free tier means while the service is being built.
            </Section>

            <Section title="Open source">
              Moogo is built in the open. The source, the issue tracker, and
              the security policy all live on{" "}
              <a
                href="https://github.com/moogodev/moogodev"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-strong underline underline-offset-4 hover:text-accent"
              >
                GitHub
              </a>
              , and contributions, bug reports, and feature discussions are
              welcome there.
            </Section>

            <Section title="Contact">
              Questions, feedback, or offers to help — the{" "}
              <Link to="/contact" className="text-accent-strong underline underline-offset-4 hover:text-accent">
                contact page
              </Link>{" "}
              lists every way to reach the project, including the address that
              answers each message.
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
