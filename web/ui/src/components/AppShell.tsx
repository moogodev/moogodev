import { Link, useLocation, Outlet } from "react-router-dom";
import { Brand } from "./Brand";
import { ThemeToggle } from "./ThemeToggle";
import { api, ApiError, type Me } from "../lib/api";
import { useState, useEffect } from "react";

// AppShell is the signed-in frame: a fixed sidebar plus the routed page.
//
// It is wrapped in .console for the font weight, not for the palette. The theme
// is a document-level choice now, so the console follows whatever the visitor
// picked on the marketing pages instead of being pinned to one look.
export function AppShell() {
  const location = useLocation();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="console min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-edge bg-background-alt">
        <div className="flex h-14 items-center border-b border-edge px-4">
          <Brand />
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Main">
          <NavItem to="/app" active={location.pathname === "/app"} icon={<DashboardIcon />}>
            Dashboard
          </NavItem>
          <NavItem
            to="/app/projects"
            active={location.pathname === "/app/projects" || !!projectId}
            icon={<ProjectIcon />}
          >
            Project
          </NavItem>
          <NavItem
            to="/app/settings"
            active={location.pathname === "/app/settings"}
            icon={<SettingsIcon />}
          >
            Settings
          </NavItem>
          <NavItem
            to="/plan"
            active={location.pathname === "/plan"}
            icon={<PricingIcon />}
          >
            Pricing
          </NavItem>
          <NavItem
            to="/docs/quickstart"
            active={location.pathname.startsWith("/docs")}
            icon={<DocsIcon />}
          >
            Docs
          </NavItem>

          {projectId && (
            <div className="mt-4">
              <p className="px-3 pb-1 text-[0.7rem] font-bold uppercase tracking-wider text-faint">
                This project
              </p>
              <NavItem
                to={`/app/projects/${projectId}/database`}
                active={location.pathname.includes("/database")}
                icon={<DatabaseIcon />}
              >
                Database
              </NavItem>
              <NavItem
                to={`/app/projects/${projectId}/bucket`}
                active={location.pathname.includes("/bucket")}
                icon={<BucketIcon />}
              >
                Bucket
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
      </aside>

      <main className="ml-60 min-h-screen">
        {loading ? (
          <div className="flex h-screen items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-strong border-t-transparent" />
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
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

function BucketIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z" />
      <line x1="8" y1="10" x2="16" y2="10" />
      <line x1="8" y1="14" x2="16" y2="14" />
    </svg>
  );
}