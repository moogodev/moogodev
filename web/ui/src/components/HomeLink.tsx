import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { homeHref } from "../lib/origin";

// A link that means "take me to Moogo's home page".
//
// React Router only navigates within one origin, so the moment home is a
// different host this has to be a plain anchor and let the browser do the
// navigation. On the apex — and in local development — it stays an SPA link, so
// nothing that used to navigate in place now forces a reload.
//
// See lib/origin.ts for why the apex cannot be reached with a relative link
// from a subdomain: nginx 301s that URL away on a full load, so the page a
// client-side navigation shows and the page a reload shows are not the same.
export function HomeLink({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const href = homeHref("/");

  if (href === "/") {
    return (
      <Link to="/" className={className}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}
