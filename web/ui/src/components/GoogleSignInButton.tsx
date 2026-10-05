// The "Continue with Google" button and its icon.
//
// Both of these lived as private copies inside Login.tsx and Register.tsx, and
// the copies drifted: one used the real four-colour Google mark, the other had
// been redrawn as four monochrome paths in currentColor. Identical button,
// different logo, which is exactly the kind of small inconsistency people read
// as "this site was built in a hurry". Now there is one copy.
//
// The mark is the official four-segment Google G, drawn in white instead of the
// brand colours. The four paths are kept rather than collapsed into one, because
// they are the real geometry: painted in a single colour they tile the whole G
// with no seams and no overlap. Recolouring them is the difference between
// "the Google logo in white" and "a G-shaped blob that happens to sit where a
// logo would go".
//
// It is white rather than currentColor on purpose: the button fills with the
// accent, and on the dark theme that accent is a mid teal, which the coloured
// logo does not survive on. White reads on both themes.
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 flex-none fill-white">
      <path d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.1 14.7 2 12 2 6.9 2 2.8 6.2 2.8 11.3S6.9 20.6 12 20.6c5.6 0 9.3-3.9 9.3-9.4 0-.6-.07-1.1-.2-1.6H12z" />
      <path d="M5.3 12c0-.7.12-1.4.3-2H2.6A12.9 12.9 0 0 0 2 12c0 1.9.45 3.7 1.25 5.3l3.35-2.6c-.2-.65-.3-1.35-.3-2.1z" />
      <path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.2v2.6A12 12 0 0 0 12 22z" />
      <path d="M6.4 14.1A7.2 7.2 0 0 1 6.1 12c0-.7.12-1.4.3-2L3.15 7.3A9.9 9.9 0 0 0 2 12c0 1.6.4 3.1 1.1 4.4l3.3-2.3z" />
    </svg>
  );
}

// The whole button, not just the icon, so the two pages cannot drift again.
// The login and register pages show the same call to action above the same
// "or" divider; if the wording, the icon or the padding changes, it changes
// once, here.
//
// It is always rendered. Hiding it until an operator configures Google would
// mean the layout shifts for no reason a visitor can act on, so when the
// deployment has no credentials the button points at the setup page and says
// so underneath.
//
// The label is forced white for the same reason the icon is. The button's own
// text-accent-ink is near-black on the dark theme, and a white logo beside
// near-black text is the logo reading as the odd one out. Forcing both keeps
// the mark and the words on the same footing, which is the only reason to want
// a white Google mark on a coloured button at all.
export function GoogleSignInButton({ configured }: { configured: boolean }) {
  return (
    <>
      <a
        href={configured ? "/auth/google" : "/auth/setup"}
        className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent-strong px-5 py-3 font-semibold text-white transition-colors hover:bg-accent"
      >
        <GoogleIcon />
        Continue with Google
      </a>

      {!configured && (
        <p className="mt-2 text-center text-[0.82rem] text-faint">
          Google sign-in is not enabled on this deployment yet.
        </p>
      )}
    </>
  );
}