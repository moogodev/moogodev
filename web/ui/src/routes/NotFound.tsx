import { SiteLayout } from "../components/Layout";
import { HomeLink } from "../components/HomeLink";

export default function NotFound() {
  return (
    <SiteLayout>
      <section className="py-24 text-center">
        <div className="mx-auto w-full max-w-[720px] px-6">
          <p className="mb-3 font-mono text-[0.85rem] tracking-[0.2em] text-faint">
            404
          </p>
          <h1 className="mb-3 text-[clamp(1.8rem,3.4vw,2.4rem)] font-semibold tracking-tight">
            That page does not exist.
          </h1>
          <p className="mb-7 text-muted">
            The link may be old, or the address may have a typo.
          </p>
          <HomeLink
            className="inline-flex items-center justify-center rounded-lg bg-accent-strong px-5 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent"
          >
            Back to the landing page
          </HomeLink>
        </div>
      </section>
    </SiteLayout>
  );
}
