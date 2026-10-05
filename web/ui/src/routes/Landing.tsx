import { Link } from "react-router-dom";
import { SiteLayout } from "../components/Layout";
import { CodeTabs } from "../components/CodeTabs";
import "../landing.css";

// The feature copy is kept next to the section that renders it rather than in a
// separate data file, because each entry exists to justify the card it sits in.
// The old page had a flat list of six items that all read as the same kind of
// claim; grouping them says what kind of thing each one actually is.
const pillars = [
  {
    label: "Database",
    accent: true,
    items: [
      {
        title: "One file per project",
        body: "Every project is a separate SQLite file on disk. There is no shared table and no tenant_id column to forget in a WHERE clause, so isolation is a property of the filesystem rather than a policy somebody has to keep writing.",
      },
      {
        title: "Prepared statements only",
        body: "Values travel in args and are bound by the engine. A value can never become syntax, so injection is not reduced on this path — it has nowhere to happen.",
      },
      {
        title: "Every statement is parsed first",
        body: "ATTACH, readfile, writefile, extension loading and stacked statements are rejected before a statement runs. The check runs on tokens, so a table called attachments is not mistaken for ATTACH.",
      },
      {
        title: "WAL, foreign keys, one connection each",
        body: "Reads never block the writer, writes are serialised per project, and foreign keys are enforced. Concurrency is handled so you do not have to think about SQLITE_BUSY.",
      },
    ],
  },
  {
    label: "Storage",
    accent: false,
    items: [
      {
        title: "256 MB of files per project",
        body: "Organise with buckets and prefixes, upload with a plain PUT. Storage has its own credential, so a key scoped to running SELECT cannot overwrite your files.",
      },
      {
        title: "Public URLs without ceremony",
        body: "Publish an object and it is readable at a stable URL with no header, no cookie and no session. Private objects answer 404, so an unlisted file is indistinguishable from one that does not exist.",
      },
      {
        title: "Policies enforced server-side",
        body: "Restrict a bucket to images or video and cap the size of a single object. The rule is checked on every write, not only in the file picker.",
      },
    ],
  },
  {
    label: "Dashboard",
    accent: false,
    items: [
      {
        title: "Tables as a spreadsheet",
        body: "Browse, sort, filter and edit rows without writing a query. Build tables with a form instead of remembering the exact DDL.",
      },
      {
        title: "A console that tells you why",
        body: "The console runs the same sanitizer and the same read/write rules as the public API, and reports the same error code you would get in production.",
      },
      {
        title: "It never sees your key",
        body: "The dashboard authorises with your session, not your secret key. That is the point: a key in a browser leaks through devtools, a screenshot, or an extension.",
      },
    ],
  },
];

const steps = [
  {
    title: "Create a project",
    body: "You get a URL, an id, and a key. The key is shown once, because only a hash of it is ever stored.",
  },
  {
    title: "Put three values in your env",
    body: "No driver, no connection string, no pool. If it runs on HTTP, it can talk to Moogo.",
  },
  {
    title: "Query it like SQL",
    body: "One POST with a statement and its arguments. Reads go to /query, writes to /exec.",
  },
];

const dashboardTools = [
  {
    title: "Table builder",
    body: "Create and alter tables from a form. It writes the DDL you would have had to get right by hand.",
  },
  {
    title: "Spreadsheet editor",
    body: "Add, edit and delete rows directly. Each change is a parameterised statement, not a string you assembled.",
  },
  {
    title: "SQL console",
    body: "Run anything and read the same error codes your application will see.",
  },
  {
    title: "Activity log",
    body: "Every request with its method, status and duration, kept for seven days. Answers what ran and what it cost.",
  },
  {
    title: "Backups",
    body: "Download the whole database as a .db file. It is a real SQLite file, so your own tooling opens it.",
  },
  {
    title: "Key rotation",
    body: "Issue a new key in one click. The old one stops working immediately.",
  },
];

const guarantees = [
  {
    lead: "The key is stored hashed.",
    body: "A leaked database dump does not hand over working credentials, because there is nothing recoverable to hand over.",
  },
  {
    lead: "The project id lives in the path.",
    body: "One source of truth, so authorisation cannot disagree with routing.",
  },
  {
    lead: "Ownership is checked per request.",
    body: "Another account's project answers 404, not 403, so ids cannot be probed for existence.",
  },
  {
    lead: "Every statement is parsed first.",
    body: "No file access, no extension loading, no stacked statements.",
  },
  {
    lead: "Errors do not leak internals.",
    body: "A failed statement reports the table it wanted. A panic reports nothing at all.",
  },
  {
    lead: "The limits come back in the response.",
    body: "Usage, size and duration are reported, so you find out from the API instead of from a hung tab.",
  },
];

// Answering these on the page is cheaper than answering them in support. Every
// entry is a question a developer actually has before they trust a hosted
// database with their data, and the answer is short enough to scan.
const faqs = [
  {
    q: "Why SQLite and not Postgres?",
    a: "Because most applications do not need Postgres, and the operational cost of it is real. A function that runs to completion would otherwise have to manage a connection, a pool, or a proxy. SQLite over HTTP removes that work, and one file per project removes the shared-tenant question entirely.",
  },
  {
    q: "Is it just a thin wrapper over something else?",
    a: "No. Your database is a SQLite file on disk, and you can download it as a .db file and open it with the official SQLite tooling. What Moogo adds is the hosted API, the per-project isolation, and the statement validation.",
  },
  {
    q: "What happens if my key leaks?",
    a: "Rotate it. The new key works immediately and the old one stops working immediately. Because only a hash is stored, a dump of the control plane does not contain working keys, and rotation is the whole remediation.",
  },
  {
    q: "Can I write arbitrary SQL?",
    a: "Yes, within limits that exist for safety rather than convenience. ATTACH, file access, extension loading, stacked statements and triggers are refused. PRAGMA is restricted to read-only introspection. Every one of these is listed in the security documentation with the reason.",
  },
  {
    q: "Does it pause when I am not using it?",
    a: "No. There is no idle timeout, so there is no cold start to design around. If you want to stop using a project, you pause it deliberately, and that is reversible.",
  },
  {
    q: "What if I outgrow 100 MB?",
    a: "Then you have outgrown it, and you should know that now rather than after building on it. Two projects per account, 100 MB each, is the current free tier. The limits are enforced before a write commits, never silently.",
  },
  {
    q: "Is there really no billing?",
    a: "Not in this version. Every account is on the same plan, which also means nothing on this page can quietly expire. The data model already has the columns billing would need.",
  },
  {
    q: "Does it work from a Cloudflare Worker?",
    a: "Yes. It is HTTP with a bearer token and no sockets to hold open, which is the shape serverless runtimes handle well. Storage uses a separate credential so you can scope it independently of the SQL key.",
  },
];

// Every entry links to its own guide page under /docs, so the homepage tiles
// and the docs sidebar stay in sync. Icons are the brand SVGs from Simple
// Icons (simpleicons.org, CC0) served via the jsDelivr CDN, pinned to v14 so
// a re-release cannot swap artwork underneath us.
const stacks = [
  { name: "JavaScript", doc: "javascript-vanilla", icon: "javascript" },
  { name: "TypeScript", doc: "javascript-vanilla", icon: "typescript" },
  { name: "React", doc: "react", icon: "react" },
  { name: "Node.js", doc: "javascript-vanilla", icon: "nodedotjs" },
  { name: "Next.js", doc: "nextjs", icon: "nextdotjs" },
  { name: "Nuxt", doc: "nuxt", icon: "nuxt" },
  { name: "Vue", doc: "vue", icon: "vuedotjs" },
  { name: "Astro", doc: "astro", icon: "astro" },
  { name: "Python", doc: "python-vanilla", icon: "python" },
  { name: "FastAPI", doc: "fastapi", icon: "fastapi" },
  { name: "Flask", doc: "flask", icon: "flask" },
  { name: "Django", doc: "django", icon: "django" },
  { name: "PHP", doc: "php-vanilla", icon: "php" },
  { name: "Laravel", doc: "laravel", icon: "laravel" },
  { name: "Go", doc: "go", icon: "go" },
  { name: "Rails", doc: "ruby-rails", icon: "rubyonrails" },
  { name: "Kotlin", doc: "java-kotlin", icon: "kotlin" },
];

const STACK_ICON_CDN = "https://cdn.jsdelivr.net/npm/simple-icons@v14/icons";

// The Hero is the part of this page that was already right, so it is kept
// exactly as it was -- same markup, same copy, same classes. The only change
// anywhere inside it is the "Start free" target: it pointed at /auth/google,
// which redirects to an operator setup page when Google OAuth is not configured,
// so a visitor clicking the main call to action landed somewhere useless.
// Everything redesigned on this page lives below this component.
function Hero() {
  return (
    <section className="hero-grid">
      <div className="relative mx-auto w-full max-w-[1120px] px-6 py-16 lg:py-20 text-center">
        <p className="mb-4 inline-block text-[0.76rem] font-semibold uppercase tracking-[0.13em] text-accent-strong">
          SQLite over HTTP
        </p>
        <h1 className="mb-5 text-[clamp(2.4rem,5.2vw,3.6rem)] font-semibold leading-tight tracking-tight">
          A True Database for Serverless Apps
        </h1>
        <p className="mb-10 max-w-[42em] mx-auto text-lg text-muted">
          Built with Go for serverless apps. Each project gets its own SQLite
          file and key — SQL over HTTP, no connection string, no driver. A
          <code className="rounded bg-panel-raised px-1.5 font-mono text-[0.87em] text-accent">
            moogo.md
          </code>
          lets AI use your DB directly. No pause, no cold starts, no credit card.
        </p>
        <div className="mb-12 flex flex-wrap justify-center gap-3">
          <Link
            to="/register"
            className="inline-flex items-center justify-center rounded-lg bg-accent-strong px-5 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent"
          >
            Start free
          </Link>
          <Link
            to="/docs/quickstart"
            className="inline-flex items-center justify-center rounded-lg border border-edge-strong px-5 py-3 font-semibold transition-colors hover:border-hover-edge hover:bg-hover-bg"
          >
            Read the docs
          </Link>
        </div>
        <dl className="flex flex-wrap justify-center gap-x-8 gap-y-4 border-t border-edge pt-7">
          <Fact value="100 MB" label="SQLite / project" />
          <Fact value="2" label="projects / user" />
          <Fact value="256 MB" label="bucket / project" />
          <Fact value="No pause" label="always on" />
          <Fact value="No credit" label="free forever" />
        </dl>
      </div>
    </section>
  );
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="text-2xl font-semibold tracking-tight">{value}</dt>
      <dd className="mt-0.5 text-[0.84rem] text-faint">{label}</dd>
    </div>
  );
}

export default function Landing() {
  return (
    <SiteLayout>
      {/* The rails are the page's frame: two hairlines running the full height
          of the content, with every section sitting between them. It is what
          keeps eleven stacked sections from reading as one long scroll, and it
          costs nothing because the borders are on the wrapper rather than on any
          individual section.

          They are inset from the viewport edge by max-w so they frame the
          content instead of sitting against the window, which is what makes
          them read as deliberate rather than as a border on the browser. */}
      <div className="relative mx-auto w-full max-w-[1280px] border-x border-edge">
<Hero />
        <Languages />
        <Problem />
        <HowItWorks />
        <Showcase />
        <Pillars />
        <DashboardSection />
        <Security />
        <Pricing />
        <Faq />
        <Closing />
      </div>
    </SiteLayout>
  );
}

// A hairline between sections that do not already carry a background change.
// Rendered as a real <hr> rather than a styled div so it appears in the
// document outline and can be skipped by assistive technology like any divider.
function Divider() {
  return <hr className="divider" />;
}

// The problem is stated before the feature list on purpose. A list of six
// capabilities reads as a list; a problem the reader recognises is what makes the
// capabilities mean something.
function Problem() {
  const pains = [
    {
      title: "Connections are your problem now",
      body: "A serverless function has no long-lived process, so every cold start means a new connection. You end up writing a pool, or putting a proxy in front, or paying for a driver that manages sockets for you.",
    },
    {
      title: "Shared databases share risk",
      body: "Isolating tenants with row-level policies is powerful, and it works right up until a policy is written one WHERE clause short. It is the most common multi-tenant data leak in the ecosystem.",
    },
    {
      title: "You probably do not need Postgres",
      body: "Most applications are a few tables, a few queries, and a few megabytes. What they need is to not think about the database at all — which is exactly what a mature embedded engine is good at.",
    },
  ];

  return (
    <section className="dot-grid py-16 sm:py-20">
      <div className="mx-auto w-full max-w-[1120px] px-6">
        <h2 className="mb-2 text-[clamp(1.7rem,3.2vw,2.3rem)] font-semibold tracking-tight">
          The database should be the part you do not run.
        </h2>
        <p className="mb-10 max-w-[46em] text-muted">
          Most of the work in shipping a small application is not the
          application. It is the database underneath it.
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          {pains.map((pain, index) => (
            <article
              key={pain.title}
              className="surface card-hover p-6"
            >
              <span className="mb-4 block font-mono text-[0.78rem] font-semibold text-faint">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mb-2 text-[1.02rem] font-semibold tracking-tight">
                {pain.title}
              </h3>
              <p className="text-[0.93rem] leading-relaxed text-muted">
                {pain.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="py-16 sm:py-20">
      <Divider />
      <div className="mx-auto w-full max-w-[1120px] px-6 pt-16 sm:pt-20">
        <h2 className="mb-2 text-[clamp(1.7rem,3.2vw,2.3rem)] font-semibold tracking-tight">
          Three steps, then it is yours.
        </h2>
        <p className="mb-10 max-w-[46em] text-muted">
          There is no migration to write, no client library to install, and no
          connection to keep alive.
        </p>

        <ol className="steps-rail grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="surface card-hover p-6">
              <span className="step-marker mb-4">
                {index + 1}
              </span>
              <h3 className="mb-2 text-[1.02rem] font-semibold tracking-tight">
                {step.title}
              </h3>
              <p className="text-[0.93rem] leading-relaxed text-muted">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// The code is the argument. For a developer tool this is the section that
// actually persuades, and it is why CodeTabs exists in the codebase.
function Showcase() {
  return (
    <section className="section-glow border-y border-edge bg-background-alt py-16 sm:py-20">
      <div className="mx-auto w-full max-w-[1120px] px-6">
        <div className="mb-9 text-center">
          <p className="mb-3 text-[0.76rem] font-semibold uppercase tracking-[0.13em] text-accent-strong">
            The integration
          </p>
          <h2 className="mb-3 text-[clamp(1.7rem,3.2vw,2.3rem)] font-semibold tracking-tight">
            That is the entire integration.
          </h2>
          <p className="mx-auto max-w-[46em] text-muted">
            A URL and a key. No SDK, no ORM, no connection string. Copy the
            request and paste it into your own project.
          </p>
        </div>

        <CodeTabs />
      </div>
    </section>
  );
}

// Languages runs two marquee rows in opposite directions: the top row drifts
// right, the bottom row drifts left. Each row renders its list twice so the
// -50% loop point lands on an identical frame and the wrap is seamless.
// Logos are bare links with no card outline; the white chip behind each black
// Simple Icons glyph is only there so the artwork stays legible in both
// light and dark themes.
function Languages() {
  const top = stacks.slice(0, 8);
  const bottom = stacks.slice(8);

  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto w-full max-w-[1120px] px-6">
        <p className="mb-3 text-[0.76rem] font-semibold uppercase tracking-[0.13em] text-accent-strong">
          Works with your stack
        </p>
        <h2 className="mb-2 text-[clamp(1.7rem,3.2vw,2.3rem)] font-semibold tracking-tight">
          If it speaks HTTP, it speaks Moogo.
        </h2>
        <p className="mb-10 max-w-[46em] text-muted">
          Each logo opens a setup-to-usage guide for SQLite and bucket storage
          in that language or framework.
        </p>
      </div>

      <div className="stack-marquee" aria-label="Supported stacks, row one">
        <div className="stack-track stack-track-right">
          {Array(3).fill(top).flat().map((stack, index) => (
            <StackLogo key={`${stack.name}-top-${index}`} stack={stack} />
          ))}
        </div>
      </div>
      <div className="stack-marquee" aria-label="Supported stacks, row two">
        <div className="stack-track stack-track-left">
          {Array(3).fill(bottom).flat().map((stack, index) => (
            <StackLogo key={`${stack.name}-bottom-${index}`} stack={stack} />
          ))}
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1120px] px-6">
        <p className="mt-8 text-center text-[0.9rem] text-muted">
          Stack guides:{" "}
          {stacks.map((stack, index) => (
            <span key={stack.name}>
              {index > 0 && " · "}
              <Link
                to={`/docs/${stack.doc}`}
                className="text-accent-strong hover:underline"
              >
                {stack.name}
              </Link>
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}

// StackLogo is a bare logo link: no card, no border. The white chip keeps the
// black glyph readable on dark backgrounds.
function StackLogo({ stack }: { stack: { name: string; doc: string; icon: string } }) {
  return (
    <Link
      to={`/docs/${stack.doc}`}
      title={`${stack.name} guide`}
      aria-label={`${stack.name} guide`}
      className="stack-logo"
    >
      <img
        src={`${STACK_ICON_CDN}/${stack.icon}.svg`}
        alt={`${stack.name} logo`}
        loading="lazy"
        width={36}
        height={36}
      />
    </Link>
  );
}

function Pillars() {
  return (
    <section id="features" className="dot-grid py-16 sm:py-20">
      <div className="mx-auto w-full max-w-[1120px] px-6">
        <h2 className="mb-2 text-[clamp(1.7rem,3.2vw,2.3rem)] font-semibold tracking-tight">
          What you actually get
        </h2>
        <p className="mb-10 max-w-[46em] text-muted">
          Three things, described plainly. Everything below works today, not on
          the roadmap.
        </p>

        <div className="grid gap-8 lg:grid-cols-3">
          {pillars.map((pillar) => (
            <div key={pillar.label}>
              {/* The column header carries the accent and sits directly on the
                  card column's edge rule, so the group reads as one unit
                  rather than a heading floating above three loose cards. */}
              <div className="mb-4 flex items-center gap-2.5 border-b border-edge pb-3">
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 rounded-full ${
                    pillar.accent ? "bg-accent-strong" : "bg-edge-strong"
                  }`}
                />
                <h3
                  className={`text-[0.76rem] font-semibold uppercase tracking-[0.13em] ${
                    pillar.accent ? "text-accent-strong" : "text-muted"
                  }`}
                >
                  {pillar.label}
                </h3>
              </div>

              <ul className="flex flex-col gap-3">
                {pillar.items.map((item) => (
                  <li
                    key={item.title}
                    className="surface card-hover p-5"
                  >
                    <h4 className="mb-1.5 text-[0.98rem] font-semibold tracking-tight">
                      {item.title}
                    </h4>
                    <p className="text-[0.91rem] leading-relaxed text-muted">
                      {item.body}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DashboardSection() {
  return (
    <section className="border-y border-edge bg-background-alt py-16 sm:py-20">
      <div className="mx-auto w-full max-w-[1120px] px-6">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center lg:gap-14">
          <div>
            <p className="mb-3 text-[0.76rem] font-semibold uppercase tracking-[0.13em] text-accent-strong">
              Dashboard
            </p>
            <h2 className="mb-3 text-[clamp(1.7rem,3.2vw,2.3rem)] font-semibold tracking-tight">
              A studio that never asks for your key
            </h2>
            <p className="mb-5 text-muted">
              The dashboard browses your data as a spreadsheet, builds tables,
              runs SQL, and keeps an audit trail — without your secret key ever
              entering the browser.
            </p>
            <p className="mb-7 text-[0.93rem] leading-relaxed text-muted">
              That is deliberate. A key in a browser leaks through devtools, a
              screenshot or an extension, and once it is out there you cannot know
              how many copies exist. So the dashboard authorises with your
              session instead, and runs the same validation your application
              does.
            </p>
            <Link
              to="/docs/dashboard"
              className="inline-flex items-center gap-1.5 font-semibold text-accent-strong transition-colors hover:text-accent"
            >
              Tour the dashboard
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {dashboardTools.map((tool, index) => (
              <li
                key={tool.title}
                className="surface card-hover p-5"
              >
                <span className="icon-tile mb-3.5">
                  <svg
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    aria-hidden="true"
                  >
                    {index === 0 ? (
                      <>
                        <rect x="3" y="3.5" width="14" height="13" rx="2" />
                        <path d="M3 8h14M8 8v8.5" strokeLinecap="round" />
                      </>
                    ) : index === 1 ? (
                      <>
                        <rect x="3" y="4" width="14" height="12" rx="2" />
                        <path d="m6.5 10 2 2 4-4.5" strokeLinecap="round" strokeLinejoin="round" />
                      </>
                    ) : index === 2 ? (
                      <>
                        <path d="m7 6-3.5 4L7 14M13 6l3.5 4L13 14" strokeLinecap="round" strokeLinejoin="round" />
                      </>
                    ) : index === 3 ? (
                      <>
                        <path d="M4 14.5h12M4 10.5h12M4 6.5h7" strokeLinecap="round" />
                      </>
                    ) : index === 4 ? (
                      <>
                        <path d="M10 3.5v9" strokeLinecap="round" />
                        <path d="M7 9.5v2.5a3 3 0 0 0 6 0V9.5" strokeLinecap="round" />
                        <path d="M6.5 15.5h7" strokeLinecap="round" />
                      </>
                    ) : (
                      <path
                        d="M15.5 10a5.5 5.5 0 1 1-1.9-4.2M15.5 3.5V7H12"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                  </svg>
                </span>
                <h3 className="mb-1 text-[0.95rem] font-semibold tracking-tight">
                  {tool.title}
                </h3>
                <p className="text-[0.89rem] leading-relaxed text-muted">
                  {tool.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Security() {
  return (
    <section
      id="security"
      className="border-y border-edge bg-background-alt py-16 sm:py-20"
    >
      <div className="mx-auto w-full max-w-[760px] px-6">
        <p className="mb-3 text-[0.76rem] font-semibold uppercase tracking-[0.13em] text-accent-strong">
          Security
        </p>
        <h2 className="mb-2 text-[clamp(1.7rem,3.2vw,2.3rem)] font-semibold tracking-tight">
          Assume the stranger has your key
        </h2>
        <p className="mb-9 text-muted">
          That is the threat model. These are the properties that hold when they
          do.
        </p>
        <ul className="border-t border-edge">
          {guarantees.map((item) => (
            <li
              key={item.lead}
              className="relative border-b border-edge py-4 pl-8.5 text-muted transition-colors hover:bg-background"
            >
              <span
                aria-hidden="true"
                className="absolute top-[1.4rem] left-1 h-2 w-2 rounded-sm bg-accent-strong"
              />
              <strong className="text-foreground">{item.lead}</strong>{" "}
              {item.body}
            </li>
          ))}
        </ul>
        <p className="mt-6 text-[0.9rem] text-faint">
          What this model does not cover is documented too:{" "}
          <Link to="/docs/security" className="text-accent-strong hover:underline">
            the security page
          </Link>{" "}
          has a section on it, because a list of strengths is not a threat model.
        </p>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="py-16 sm:py-20">
      <div className="mx-auto w-full max-w-[560px] px-6">
        <p className="mb-3 text-center text-[0.76rem] font-semibold uppercase tracking-[0.13em] text-accent-strong">
          Pricing
        </p>
        <h2 className="mb-2 text-center text-[clamp(1.7rem,3.2vw,2.3rem)] font-semibold tracking-tight">
          Free, and it stays free
        </h2>
        <p className="mb-8 text-center text-muted">
          One plan. No card, no trial that expires, no feature held back.
        </p>

        {/* Flat like every other card, and leaning on the accent border rather than a
            shadow to say "this is the one plan". */}
        <div className="surface rounded-2xl p-8">
          <div className="mb-6 flex items-baseline justify-between border-b border-edge pb-6">
            <div>
              <p className="text-[0.8rem] font-semibold uppercase tracking-[0.11em] text-accent-strong">
                Free
              </p>
              <p className="mt-1 text-[2.6rem] font-semibold tracking-tight">
                $0
              </p>
            </div>
            <p className="text-right text-[0.86rem] leading-snug text-faint">
              Forever, for as long
              <br />
              as it is in use
            </p>
          </div>

          <ul className="mb-8 flex flex-col gap-2.5">
            {[
              "2 projects, 100 MB of SQLite each",
              "256 MB of object storage per project",
              "The full dashboard and SQL console",
              "No idle pause and no cold start",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5 text-[0.93rem] text-muted">
                <svg
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                  className="mt-1 h-3.5 w-3.5 flex-none stroke-accent-strong"
                  fill="none"
                  strokeWidth="2.2"
                >
                  <path d="m4 10.5 4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {line}
              </li>
            ))}
          </ul>

          <Link
            to="/register"
            className="inline-flex w-full items-center justify-center rounded-lg bg-accent-strong px-5 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent"
          >
            Create an account
          </Link>
          <p className="mt-4 text-center text-[0.85rem] text-faint">
            Already have one?{" "}
            <Link to="/login" className="text-accent-strong hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="border-t border-edge py-16 sm:py-20">
      <div className="mx-auto w-full max-w-[760px] px-6">
        <p className="mb-3 text-[0.76rem] font-semibold uppercase tracking-[0.13em] text-accent-strong">
          FAQ
        </p>
        <h2 className="mb-2 text-[clamp(1.7rem,3.2vw,2.3rem)] font-semibold tracking-tight">
          Questions worth asking first
        </h2>
        <p className="mb-9 text-muted">
          The ones that come up before anyone hands over their data.
        </p>

        <div className="flex flex-col gap-3">
          {faqs.map((faq) => (
            /* details/summary gives keyboard operation and the expanded state
               for free; faq-item and faq-chevron are styled in landing.css. */
            <details key={faq.q} className="faq-item surface card-hover px-5 py-4">
              <summary className="flex items-start font-semibold tracking-tight">
                <span className="faq-chevron" aria-hidden="true" />
                {faq.q}
              </summary>
              <p className="faq-answer text-[0.93rem] leading-relaxed text-muted">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Closing() {
  return (
    <section className="closing-glow border-t border-edge py-24 text-center">
      <div className="mx-auto w-full max-w-[1120px] px-6">
        <h2 className="mb-2 text-[clamp(1.7rem,3.2vw,2.3rem)] font-semibold tracking-tight">
          Ship the thing that uses the data.
        </h2>
        <p className="mb-8 text-lg text-muted">Not the database.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to="/register"
            className="inline-flex items-center justify-center rounded-lg bg-accent-strong px-5 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent"
          >
            Create a project
          </Link>
          <Link
            to="/docs/quickstart"
            className="inline-flex items-center justify-center rounded-lg border border-edge-strong px-5 py-3 font-semibold transition-colors hover:border-hover-edge hover:bg-hover-bg"
          >
            Read the docs
          </Link>
        </div>
      </div>
    </section>
  );
}