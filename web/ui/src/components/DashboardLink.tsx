import type { MouseEventHandler, ReactNode } from "react";
import { Link } from "react-router-dom";
import { appOrigin } from "../lib/origin";

// A link that means "take me to the dashboard".
//
// React Router only navigates within one origin: pushState can change the path,
// never the host. From the apex a relative "/app" therefore stays on moogo.dev,
// and because the backend serves the same SPA shell on every vhost the wrong
// domain renders instead of failing — nginx's 301 safety net never fires,
// because a client-side navigation produces no HTTP request at all.
//
// On the dashboard host itself — and in local development, where there is no
// separate app host — it stays an SPA link, so nothing that used to navigate in
// place now forces a reload.
//
// See lib/origin.ts for why the dashboard host cannot be reached with a
// relative link from the apex.
export function DashboardLink({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}) {
  const href = `${appOrigin()}/app`;
  const sameOrigin = href === `${window.location.origin}/app`;

  if (sameOrigin) {
    return (
      <Link to="/app" className={className} onClick={onClick}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  );
}
