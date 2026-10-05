import { Link } from "react-router-dom";

// Brand uses the Moogo logo image from the official assets repo.
// Light/dark switching handled by CSS using .theme-dark class.
export function Brand() {
  return (
    <Link
      to="/"
      className="inline-flex flex-none items-center"
    >
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
    </Link>
  );
}