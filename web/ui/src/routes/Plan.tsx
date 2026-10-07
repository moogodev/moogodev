import { useState } from "react";
import { Link } from "react-router-dom";
import { SiteLayout } from "../components/Layout";
import { DashboardLink } from "../components/DashboardLink";
import {
  MONTHS_FREE_PER_YEAR,
  plans,
  priceFor,
  type BillingPeriod,
} from "../lib/plans";
import { useSession } from "../lib/session";

// The pricing page.
//
// It exists as its own route rather than only as a section on the landing page
// because the plans outlive the current offer. Startup and Pro are published
// here with their quotas, and the page will not need a rewrite when they open:
// the plans are data, and only the available flag changes.
export default function Plan() {
  const session = useSession();
  const signedIn = session.status === "authenticated";
  // Monthly is the default because it is what a visitor arriving with no
  // intention is being asked to consider. The yearly saving is shown on the
  // toggle so it is visible before it is chosen, rather than being a reward for
  // clicking the other button.
  const [period, setPeriod] = useState<BillingPeriod>("monthly");

  return (
    <SiteLayout>
      <section className="py-16 sm:py-20">
        <div className="mx-auto w-full max-w-[1120px] px-6">
          <p className="mb-3 text-center text-[0.76rem] font-semibold uppercase tracking-[0.13em] text-accent-strong">
            Pricing
          </p>
          <h1 className="mb-3 text-center text-[clamp(1.8rem,3.6vw,2.6rem)] font-semibold tracking-tight">
            Free is the whole product
          </h1>
          <p className="mx-auto mb-9 max-w-[46em] text-center text-muted">
            One plan you can use today, and two that are not ready yet. The
            numbers on every card are the quotas the server actually enforces, so
            what you read here is what you will hit.
          </p>

          <div className="mb-9 flex justify-center">
            <BillingToggle period={period} onChange={setPeriod} />
          </div>

          {/* Three equal columns rather than Free being singled out. Free is the
              only available one, but it is not the only one: showing the other
              two at the same size is what makes them read as planned rather
              than abandoned. */}
          <div className="grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                period={period}
                signedIn={signedIn}
              />
            ))}
          </div>

          <p className="mt-10 text-center text-[0.9rem] text-faint">
            Quotas are per project and are enforced before the work commits.{" "}
            <Link to="/docs/limits" className="text-accent-strong hover:underline">
              How the limits are enforced
            </Link>
            .
          </p>
        </div>
      </section>
    </SiteLayout>
  );
}

// The period toggle.
//
// Two buttons rather than one checkbox, because a checkbox carries an
// unlabelled on and off state and these are two equally valid ways to buy the
// same plan. role="group" with the label on the wrapper says that out loud for
// anyone who cannot see the pressed state.
function BillingToggle({
  period,
  onChange,
}: {
  period: BillingPeriod;
  onChange: (next: BillingPeriod) => void;
}) {
  const options: { id: BillingPeriod; label: string; note?: string }[] = [
    { id: "monthly", label: "Monthly" },
    {
      id: "yearly",
      label: "Yearly",
      note: `${MONTHS_FREE_PER_YEAR} months free`,
    },
  ];

  return (
    <div
      role="group"
      aria-label="Billing period"
      className="inline-flex items-center gap-1 rounded-lg border border-edge-strong p-1"
    >
      {options.map((option) => {
        const active = option.id === period;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={active}
            className={`cursor-pointer rounded-md px-4 py-2 text-[0.88rem] font-semibold transition-colors ${
              active
                ? "bg-accent-strong text-accent-ink"
                : "text-muted hover:text-foreground"
            }`}
          >
            {option.label}
            {option.note && (
              <span
                className={`ml-2 text-[0.75rem] font-normal ${active ? "text-accent-ink/80" : "text-faint"}`}
              >
                {option.note}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function PlanCard({
  plan,
  period,
  signedIn,
}: {
  plan: (typeof plans)[number];
  period: BillingPeriod;
  signedIn: boolean;
}) {
  // Unavailable plans are dimmed and de-emphasised rather than hidden. A greyed
  // card with a real quota table tells a visitor the plan exists and is coming;
  // a missing card tells them nothing at all.
  const dimmed = !plan.available;
  const price = priceFor(plan, period);

  // Free is 0 in both terms, so the toggle has nothing to say about it and the
  // card says "forever" instead of inventing an annual price for something that
  // costs nothing.
  const billed = plan.monthlyPrice > 0;

  return (
    <div
      className={`surface flex flex-col rounded-2xl p-6 ${dimmed ? "opacity-70" : ""}`}
    >
      <div className="mb-5 border-b border-edge pb-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[0.8rem] font-semibold uppercase tracking-[0.11em] text-accent-strong">
            {plan.name}
          </p>
          {plan.available ? (
            <span className="rounded-full border border-accent/40 px-2 py-0.5 text-[0.7rem] font-semibold text-accent-strong">
              Available
            </span>
          ) : (
            <span className="rounded-full border border-edge-strong px-2 py-0.5 text-[0.7rem] font-semibold text-faint">
              Coming soon
            </span>
          )}
        </div>

        <p className="mt-2 text-[2.4rem] font-semibold tracking-tight">
          ${price}
          {billed && (
            <span className="ml-1 align-middle text-[0.95rem] font-normal text-muted">
              {period === "yearly" ? "/year" : "/month"}
            </span>
          )}
        </p>
        <p className="mt-2 text-[0.9rem] leading-relaxed text-muted">
          {billed
            ? period === "yearly"
              ? `Billed once a year. ${MONTHS_FREE_PER_YEAR} months free, which is ${
                  MONTHS_FREE_PER_YEAR * plan.monthlyPrice
                } less than twelve monthly payments.`
              : `Billed monthly. Switch to yearly for ${MONTHS_FREE_PER_YEAR} months free.`
            : plan.tagline}
        </p>
      </div>

      <dl className="mb-6 flex flex-col gap-3">
        {plan.quotas.map((quota) => (
          <div
            key={quota.label}
            className="flex items-baseline justify-between gap-3 border-b border-edge pb-3 last:border-0 last:pb-0"
          >
            <dt className="text-[0.88rem] text-muted">{quota.label}</dt>
            <dd className="text-[0.95rem] font-semibold text-foreground">
              {quota.value}
            </dd>
          </div>
        ))}
      </dl>

      <ul className="mb-6 flex flex-1 flex-col gap-2.5">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-[0.9rem] text-muted">
            <svg
              viewBox="0 0 20 20"
              aria-hidden="true"
              className="mt-1 h-3.5 w-3.5 flex-none stroke-accent-strong"
              fill="none"
              strokeWidth="2.2"
            >
              <path d="m4 10.5 4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {feature}
          </li>
        ))}
      </ul>

      {plan.available ? (
        signedIn ? (
          <DashboardLink className="inline-flex w-full items-center justify-center rounded-lg bg-accent-strong px-5 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent">
            Open dashboard
          </DashboardLink>
        ) : (
          <Link
            to="/register"
            className="inline-flex w-full items-center justify-center rounded-lg bg-accent-strong px-5 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent"
          >
            Create an account
          </Link>
        )
      ) : (
        // A real <button disabled> rather than a styled <span>. The element says
        // to the browser and to assistive technology that this cannot be
        // pressed, which a span with grey text does not.
        <button
          type="button"
          disabled
          className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-lg border border-edge-strong px-5 py-3 font-semibold text-faint"
        >
          Not available yet
        </button>
      )}

      {plan.unavailableNote && (
        <p className="mt-3 text-center text-[0.82rem] text-faint">{plan.unavailableNote}</p>
      )}
    </div>
  );
}