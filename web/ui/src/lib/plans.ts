// The plans, in one place.
//
// The numbers here are the quotas the server enforces, not marketing copy. The
// free tier's three figures match the server defaults exactly
// (MOOGO_DEFAULT_MAX_PROJECTS, MOOGO_DEFAULT_MAX_DB_BYTES and the per-project
// storage ceiling), so a visitor reading this page and a visitor reading the
// limits in the dashboard are being told the same thing.
//
// Only the free tier is available. Startup and Pro are listed with their real
// quotas and are not purchasable, which is why available is false rather than
// the plan being absent: a plan that is merely unannounced reads as an
// oversight, and a plan that is announced but unreachable has to say so on the
// card itself.
export interface Plan {
  id: "free" | "startup" | "pro";
  name: string;
  /**
   * The monthly price in whole dollars.
   *
   * Kept as a number rather than as formatted strings so the yearly figure can
   * be derived from it rather than typed twice. Two prices that are written out
   * separately drift, and a yearly price that disagrees with its monthly one is
   // the kind of thing nobody notices until a charge lands.
   *
   * Free is 0, which is also what excludes it from the billing toggle below:
   * there is nothing to bill annually.
   */
  monthlyPrice: number;
  tagline: string;
  /** The three quotas, in the order a reader wants them. */
  quotas: { label: string; value: string }[];
  features: string[];
  /**
   * Whether this plan can be chosen today.
   *
   * A false here is not a placeholder for a card that is nearly finished. It
   * means the server has no billing path for it yet, so no button can honestly
   * lead anywhere.
   */
  available: boolean;
  /** Shown on the card when available is false. */
  unavailableNote?: string;
}

/** Which term the prices on the page are quoted for. */
export type BillingPeriod = "monthly" | "yearly";

/**
 * Months free on an annual plan.
 *
 * Two free months is ten months of paid time, which is why the yearly total is
 * a factor of 10 and not a discount applied to 12. It is a constant rather than
 * a per-plan figure because it is the same deal on every plan: a discount that
 * varies by tier has to be explained, and this one does not.
 */
export const MONTHS_FREE_PER_YEAR = 2;

/** The yearly price, in whole dollars, after the free months. */
export function yearlyPrice(monthlyPrice: number): number {
  return monthlyPrice * (12 - MONTHS_FREE_PER_YEAR);
}

/**
 * The price to show for a term.
 *
 * Both terms are returned as whole dollars, so the card can show "billed
 * yearly" underneath and let the reader do the comparison themselves. A
 * per-month figure on an annual plan ("$8.33/month") invents precision the
 * billing does not have: the charge is one amount, once a year.
 */
export function priceFor(plan: Plan, period: BillingPeriod): number {
  return period === "yearly" ? yearlyPrice(plan.monthlyPrice) : plan.monthlyPrice;
}

export const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    monthlyPrice: 0,
    tagline: "Everything Moogo does, with no card and no expiry.",
    quotas: [
      { label: "Projects", value: "2" },
      { label: "SQLite per project", value: "100 MB" },
      { label: "Object storage per project", value: "256 MB" },
    ],
    features: [
      "The full dashboard, SQL console and bucket browser",
      "No idle pause and no cold start",
      "Backups from the dashboard",
      "No credit card, ever",
    ],
    available: true,
  },
  {
    id: "startup",
    name: "Startup",
    monthlyPrice: 5,
    tagline: "For the first version of something with real users.",
    quotas: [
      { label: "Projects", value: "5" },
      { label: "SQLite per project", value: "1 GB" },
      { label: "Object storage per project", value: "2 GB" },
    ],
    features: [
      "Everything in Free",
      "Room for a staging project alongside production",
      "Larger files and bigger databases",
    ],
    available: false,
    unavailableNote: "Not available yet — no billing is connected.",
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: 10,
    tagline: "For a product where the database is the product.",
    quotas: [
      { label: "Projects", value: "10" },
      { label: "SQLite per project", value: "2 GB" },
      { label: "Object storage per project", value: "5 GB" },
    ],
    features: [
      "Everything in Startup",
      "Databases large enough to hold a real content catalog",
      "Storage measured in gigabytes, not megabytes",
    ],
    available: false,
    unavailableNote: "Not available yet — no billing is connected.",
  },
];

/**
 * The per-project storage ceiling the server refuses to start above.
 *
 * Written here so the Pro card does not quietly promise a number the server
 * would reject at boot. Until that ceiling is raised, a 5 GB bucket is not a
 * price point, it is a misconfiguration.
 */
export const STORAGE_CEILING_MB = 256;