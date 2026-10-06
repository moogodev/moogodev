import { HomeLink } from "./HomeLink";

// Brand uses the Moogo logo image from the official assets repo.
// Light/dark switching handled by CSS using .theme-dark class.
//
// The logo means "Moogo's home", which is the apex — not "/" on whatever host
// the page happens to be served from. Rendered inside the console on
// app.moogo.dev, a link to "/" would show the marketing landing page under the
// dashboard's hostname, and a reload would bounce straight back to /app. See
// components/HomeLink and lib/origin.ts.
export function Brand() {
  return (
    <HomeLink className="inline-flex flex-none items-center">
      <img
        src="https://raw.githubusercontent.com/moogodev/moogo-img/refs/heads/main/1.png"
        alt="Moogo"
        className="h-[30px] w-auto brand-logo-light"
        loading="lazy"
      />
      <img
        src="https://raw.githubusercontent.com/moogodev/moogo-img/refs/heads/main/2.png"
        alt="Moogo"
        className="h-[30px] w-auto brand-logo-dark"
        loading="lazy"
      />
    </HomeLink>
  );
}
