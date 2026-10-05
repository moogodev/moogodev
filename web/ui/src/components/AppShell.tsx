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
          ? "bg-panel text-foreground font-medium"
          : "text-muted hover:bg-hover-bg hover:text-foreground"
      }`}
    >
      <span className="text-current [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
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
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="2.5" y="2.5" width="6" height="6" rx="1.2" />
      <rect x="11.5" y="2.5" width="6" height="6" rx="1.2" />
      <rect x="2.5" y="11.5" width="6" height="6" rx="1.2" />
      <rect x="11.5" y="11.5" width="6" height="6" rx="1.2" />
    </svg>
  );
}

function ProjectIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M2.5 6a1.5 1.5 0 011.5-1.5h3.2l1.5 1.8h7.3A1.5 1.5 0 0117.5 7.8v7.7A1.5 1.5 0 0116 17H4a1.5 1.5 0 01-1.5-1.5V6z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="10" cy="10" r="2.4" />
      <path d="M10 2.8v2M10 15.2v2M2.8 10h2M15.2 10h2M4.9 4.9l1.4 1.4M13.7 13.7l1.4 1.4M15.1 4.9l-1.4 1.4M6.3 13.7l-1.4 1.4" />
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <ellipse cx="10" cy="5" rx="6.5" ry="2.6" />
      <path d="M3.5 5v10c0 1.4 2.9 2.6 6.5 2.6s6.5-1.2 6.5-2.6V5" />
      <path d="M3.5 10c0 1.4 2.9 2.6 6.5 2.6s6.5-1.2 6.5-2.6" />
    </svg>
  );
}

function BucketIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 5.5A1.5 1.5 0 014.5 4h11A1.5 1.5 0 0117 5.5v9a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 14.5v-9z" />
      <path d="M3 8h14M6.5 12h3" />
    </svg>
  );
}
