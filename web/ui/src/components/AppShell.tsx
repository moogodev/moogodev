import { Link, useLocation, Outlet } from "react-router-dom";
import { Brand } from "./Brand";
import { ThemeToggle } from "./ThemeToggle";
import { api, ApiError, type Me } from "../lib/api";
import { useState, useEffect, useRef } from "react";

// AppShell is the signed-in frame: a sidebar plus the routed page.
//
// On wide screens the sidebar is a fixed column and the page sits beside it. On
// narrow screens the same sidebar becomes a drawer over the page: a fixed 240px
// column beside a phone-width article leaves nothing to read, so the column
// slides in from the left over a backdrop and the page keeps the full width.
// The mobile top bar is the way back to it, and the drawer carries its own
// close button so it can always be dismissed.
//
// It is wrapped in .console for the font weight, not for the palette. The theme
// is a document-level choice now, so the console follows whatever the visitor
// picked on the marketing pages instead of being pinned to one look.
export function AppShell() {
  const location = useLocation();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [navOpen, setNavOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((data) => {
        if (!cancelled) setMe(data);
      })
      .catch((cause) => {
        // A 401 means the session is gone, so send them to sign in. Any other
        // failure still renders the shell and lets each page report it.
        if (cause instanceof ApiError && cause.status === 401) {
          window.location.assign("/login");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const projectMatch = location.pathname.match(/^\/app\/projects\/([^/]+)/);
  const projectId = projectMatch ? projectMatch[1] : null;

  const closeNav = () => setNavOpen(false);

  // Navigating closes the drawer. Watching the location rather than wiring a
  // handler into every link also covers the back button and the project tabs
  // that differ only by their query string. On wide screens the drawer is not
  // mounted at all, so this only ever touches the narrow layout.
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname, location.search]);

  // While the drawer is open the page behind it must not scroll, Escape must
  // close it, and focus must move inside it so Tab stays in the drawer instead
  // of falling out into the page behind. Same three jobs the docs drawer does;
  // the media query also drops the state if the window grows to the desktop
  // layout while the drawer is open, where it is hidden by CSS but a stuck
  // navOpen would otherwise leave scrolling locked for good.
  useEffect(() => {
    if (!navOpen) return undefined;

    const desktop = window.matchMedia("(min-width: 1024px)");

    const previous = document.body.style.overflow;
    if (!desktop.matches) {
      document.body.style.overflow = "hidden";
      panelRef.current?.focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNavOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);

    const onLayoutChange = (event: MediaQueryListEvent) => {
      if (event.matches) setNavOpen(false);
    };
    desktop.addEventListener("change", onLayoutChange);

    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
      desktop.removeEventListener("change", onLayoutChange);
    };
  }, [navOpen]);

  return (
    <div className="console min-h-screen bg-background text-foreground">
      {/* Narrow screens get a bar of their own: the sidebar is off-canvas, so
          without this there is no way back to it. Wide screens hide it and keep
          the sidebar in place. */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-edge bg-background/80 px-4 backdrop-blur-md lg:hidden">
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          aria-label="Open navigation"
          aria-expanded={navOpen}
          aria-controls="app-nav"
          className="-ml-1 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-hover-bg hover:text-foreground"
        >
          <MenuIcon />
        </button>
        <Brand />
      </header>

      {/* Wide screens keep the sidebar in the layout. */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-edge bg-background-alt lg:flex">
        <div className="flex h-14 items-center border-b border-edge px-4">
          <Brand />
        </div>
        <SidebarContent projectId={projectId} pathname={location.pathname} search={location.search} me={me} />
      </aside>

      <main className="min-h-screen lg:ml-60">
        {loading ? (
          <div className="flex min-h-[70vh] items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-strong border-t-transparent" />
          </div>
        ) : (
          <Outlet />
        )}
      </main>

      {/* Narrow screens get the same sidebar as a drawer, mounted only while it
          is open so its links are never in the tab order behind the page. */}
      {navOpen && (
        <div className="lg:hidden">
          <div
            onClick={closeNav}
            aria-hidden="true"
            className="animate-fade-in fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
          />
          <div
            id="app-nav"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            tabIndex={-1}
            className="animate-slide-in-left fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-edge bg-background-alt outline-none"
          >
            <div className="flex h-14 items-center justify-between border-b border-edge px-4">
              <Brand />
              <button
                type="button"
                onClick={closeNav}
                aria-label="Close navigation"
                className="-mr-1.5 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-hover-bg hover:text-foreground"
              >
                <CloseIcon />
              </button>
            </div>
            <SidebarContent projectId={projectId} pathname={location.pathname} search={location.search} me={me} />
          </div>
        </div>
      )}
    </div>
  );
}

// SidebarContent is everything below the brand header, shared by the static
// sidebar and the mobile drawer so the two can never drift apart.
function SidebarContent({
  projectId,
  pathname,
  search,
  me,
}: {
  projectId: string | null;
  pathname: string;
  search: string;
  me: Me | null;
}) {
  return (
    <>
      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Main">
        <NavItem to="/app" active={pathname === "/app"} icon={<DashboardIcon />}>
          Dashboard
        </NavItem>
        <NavItem
          to="/app/projects"
          active={pathname === "/app/projects" || !!projectId}
          icon={<ProjectIcon />}
        >
          Project
        </NavItem>
        <NavItem to="/app/settings" active={pathname === "/app/settings"} icon={<SettingsIcon />}>
          Settings
        </NavItem>
        <NavItem to="/plan" active={pathname === "/plan"} icon={<PricingIcon />}>
          Pricing
        </NavItem>
        <NavItem to="/docs/quickstart" active={pathname.startsWith("/docs")} icon={<DocsIcon />}>
          Docs
        </NavItem>

        {projectId && (
          <div className="mt-4">
            <p className="px-3 pb-1 text-[0.7rem] font-bold uppercase tracking-wider text-faint">
              This project
            </p>
            <NavItem
              to={`/app/projects/${projectId}/database`}
              active={pathname.includes("/database") && !search.includes("tab=visual")}
              icon={<DatabaseIcon />}
            >
              Database
            </NavItem>
            <NavItem
              to={`/app/projects/${projectId}/database?tab=visual`}
              active={pathname.includes("/database") && search.includes("tab=visual")}
              icon={<SchemaIcon />}
            >
              Visual
            </NavItem>
            <NavItem
              to={`/app/projects/${projectId}/bucket`}
              active={pathname.includes("/bucket")}
              icon={<BucketIcon />}
            >
              Bucket
            </NavItem>
            <NavItem
              to={`/app/projects/${projectId}/backups`}
              active={pathname.includes("/backups")}
              icon={<BackupsIcon />}
            >
              Backups
            </NavItem>
            <NavItem
              to={`/app/projects/${projectId}/activity`}
              active={pathname.includes("/activity")}
              icon={<ActivityIcon />}
            >
              Activity
            </NavItem>
            <NavItem
              to={`/app/projects/${projectId}/settings`}
              active={pathname === `/app/projects/${projectId}/settings`}
              icon={<SettingsIcon />}
            >
              Settings
            </NavItem>
          </div>
        )}
      </nav>

      {/* The console has no footer, so the theme control that lives in one on
          the public pages sits at the bottom of the sidebar here. Same control,
          same position in the reading order. */}
      <div className="border-t border-edge p-2">
        <div className="px-1 pb-2">
          <ThemeToggle className="w-full justify-center" />
        </div>
        <UserMenu me={me} />
      </div>
    </>
  );
}

function NavItem({
  to,
  active,
  icon,
  children,
}: {
  to: string;
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-[0.86rem] transition-colors ${
        active
          ? "bg-panel text-accent-strong font-medium"
          : "text-muted hover:bg-hover-bg hover:text-foreground"
      }`}
    >
      <span className={active ? "text-accent-strong [&>svg]:h-5 [&>svg]:w-5" : "text-current [&>svg]:h-5 [&>svg]:w-5"}>{icon}</span>
      {children}
    </Link>
  );
}

function UserMenu({ me }: { me: Me | null }) {
  const initial =
    me?.user.name?.charAt(0).toUpperCase() ?? me?.user.email?.charAt(0).toUpperCase() ?? "U";

  async function signOut() {
    try {
      await api.logout();
    } finally {
      window.location.assign("/");
    }
  }

  return (
    <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-panel-raised text-[0.78rem] font-semibold text-muted">
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.82rem] font-medium text-foreground">
          {me?.user.name ?? "User"}
        </p>
        <p className="truncate text-[0.72rem] text-faint">{me?.user.email}</p>
      </div>
      <button
        type="button"
        onClick={signOut}
        className="flex-shrink-0 cursor-pointer rounded px-1.5 py-1 text-[0.72rem] text-muted transition-colors hover:text-foreground"
      >
        Sign out
      </button>
    </div>
  );
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function ProjectIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z" />
      <line x1="10" y1="10" x2="14" y2="10" />
      <line x1="10" y1="14" x2="14" y2="14" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </svg>
  );
}

function PricingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <line x1="6" y1="10" x2="18" y2="10" />
      <line x1="6" y1="14" x2="18" y2="14" />
    </svg>
  );
}

function DocsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 3H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" />
      <polyline points="14 3 14 9 20 9" />
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
    </svg>
  );
}

function SchemaIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5.5" cy="6" r="2.5" />
      <circle cx="18.5" cy="6" r="2.5" />
      <circle cx="12" cy="18" r="2.5" />
      <path d="M8 6h8M7 8l3.5 8M17 8l-3.5 8" />
    </svg>
  );
}

function BucketIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z" />
      <line x1="8" y1="10" x2="16" y2="10" />
      <line x1="8" y1="14" x2="16" y2="14" />
    </svg>
  );
}

function BackupsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <polyline points="3 4 3 9 8 9" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="12" x2="15" y2="14" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h4l3 8 4-16 3 8h4" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
