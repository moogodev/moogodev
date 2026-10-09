import type { ReactNode } from "react";
import { SiteLayout } from "../components/Layout";

// The announcement the site-wide bar links to.
//
// It exists as its own route rather than a modal or a section of the landing
// page because it is a standing status, not a moment: it stays reachable while
// Moogo is in development and only stops mattering when the project is ready
// for production — which is exactly the day the wording should change.
export default function Announcement() {
  return (
    <SiteLayout>
      <section className="py-16 sm:py-20">
        <div className="mx-auto w-full max-w-[720px] px-6">
          <p className="mb-3 text-center text-[0.76rem] font-semibold uppercase tracking-[0.13em] text-accent-strong">
            Announcement
          </p>
          <h1 className="mb-3 text-center text-[clamp(1.8rem,3.6vw,2.6rem)] font-semibold tracking-tight">
            Moogo is still in development
          </h1>
          <p className="mx-auto mb-9 max-w-[46em] text-center text-muted">
            moogo.dev is under active development and testing. You are welcome
            to try it, build on it, and tell us what is wrong — but it is not
            ready for production, and nothing here should carry data you cannot
            afford to lose.
          </p>

          <div className="grid gap-5 sm:grid-cols-2">
            <InfoCard title="Development and testing">
              The core works today: create a project, run SQL over the HTTP
              API, store objects in a bucket. Underneath, the platform is still
              being built and tested. Expect rough edges, breaking changes, and
              the occasional bug — that is what this stage is for.
            </InfoCard>

            <InfoCard title="Not ready for production">
              No uptime or durability promises are made yet. Use test data, not
              real data, and keep your own copies of anything that matters. When
              Moogo is ready for production workloads, this notice will say so.
            </InfoCard>

            <InfoCard title="Feedback and criticism">
              Criticism, suggestions, bug reports, and ideas are all welcome —
              the harsh ones included. Every message is read, and what makes
              sense is taken into account. Nothing here is too small to mention.
            </InfoCard>

            <InfoCard title="Join, sponsor, or fund">
              Want to join the effort, contribute code, sponsor the project, or
              fund its development? All of it is accepted. If you believe in a
              free, open platform for SQL and object storage, we would like to
              hear from you.
            </InfoCard>

            <div className="surface rounded-2xl p-6 text-center sm:col-span-2">
              <h2 className="mb-2 text-[1.05rem] font-semibold">Contact</h2>
              <p className="mx-auto mb-5 max-w-[42em] text-[0.93rem] leading-relaxed text-muted">
                Questions, feedback, bug reports, or offers to help — send them
                all to the address below. Every message gets a reply.
              </p>
              <a
                href="mailto:moogo.dev@gmail.com"
                className="inline-flex items-center justify-center rounded-lg bg-accent-strong px-5 py-2.5 font-semibold text-accent-ink transition-colors hover:bg-accent"
              >
                moogo.dev@gmail.com
              </a>
            </div>
          </div>

          <p className="mt-8 text-center text-[0.85rem] text-faint">
            This page is updated as Moogo moves closer to production.
          </p>
        </div>
      </section>
    </SiteLayout>
  );
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="surface rounded-2xl p-6">
      <h2 className="mb-2 text-[1.05rem] font-semibold">{title}</h2>
      <p className="text-[0.93rem] leading-relaxed text-muted">{children}</p>
    </div>
  );
}
