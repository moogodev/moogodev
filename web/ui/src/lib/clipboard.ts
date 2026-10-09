// copyToClipboard writes to the clipboard and reports the outcome.
//
// Failure is reported, never thrown at the user as a dialog: the clipboard
// is blocked on insecure origins and by permissions, and an alert() in the
// middle of a click handler stops the rest of the UI from updating while it
// waits for a dismiss. Callers show the result where the action happened —
// a button label, an announcement — and show the value itself as selectable
// text when there is nowhere else on screen to read it from, which is the
// pattern the project list already follows ("the id is selectable on
// screen").
export async function copyToClipboard(
  text: string,
  callbacks: {
    onSuccess?: () => void;
    onFail?: (cause: unknown) => void;
  } = {},
): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    callbacks.onSuccess?.();
    return true;
  } catch (cause) {
    callbacks.onFail?.(cause);
    return false;
  }
}
