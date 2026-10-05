// sizes.ts converts between bytes and the amount-plus-unit pair a settings form
// holds.
//
// The form stores the two apart because the user's answer is in the unit they
// think in: a quota of "250 MB" and a quota of "262144000 bytes" are the same
// number, and only one of them can be typed without arithmetic. Everything
// downstream -- the API, the progress bars, the rejection messages -- works in
// bytes, because that is what the server counts.

export type SizeUnit = "KB" | "MB";

const UNIT_BYTES: Record<SizeUnit, number> = {
  KB: 1024,
  MB: 1024 * 1024,
};

export interface SizeParts {
  amount: string;
  unit: SizeUnit;
}

// sizeToParts splits a byte count into a form-friendly amount and unit.
//
// It picks the larger of the two units when the value fills it, so a 250 MB quota
// reads as "250 MB" rather than "256000 KB", and 0 stays "0 KB" instead of
// becoming an empty string that would have to be special-cased on save.
export function sizeToParts(bytes: number): SizeParts {
  if (bytes >= UNIT_BYTES.MB && bytes % UNIT_BYTES.MB === 0) {
    return { amount: String(bytes / UNIT_BYTES.MB), unit: "MB" };
  }
  if (bytes >= UNIT_BYTES.MB) {
    // A value that is not a whole number of megabytes -- 100 MB plus the odd
    // kilobyte -- reads better as its exact megabytes, so the user sees the
    // number the server will enforce rather than a rounded one.
    const megabytes = bytes / UNIT_BYTES.MB;
    return { amount: megabytes.toFixed(2).replace(/\.?0+$/, ""), unit: "MB" };
  }
  if (bytes >= UNIT_BYTES.KB && bytes % UNIT_BYTES.KB === 0) {
    return { amount: String(bytes / UNIT_BYTES.KB), unit: "KB" };
  }
  return { amount: String(Math.round(bytes / UNIT_BYTES.KB)), unit: "KB" };
}

// partsToBytes turns a form amount into bytes.
//
// Returns null for anything unparseable so the caller can refuse to save rather
// than send a NaN, and returns 0 for an empty field, which is how "no per-file
// limit" is spelled.
export function partsToBytes(parts: SizeParts): number | null {
  const trimmed = parts.amount.trim();
  if (trimmed === "") {
    return 0;
  }
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }
  return Math.round(amount * UNIT_BYTES[parts.unit]);
}

// describeSize renders a byte count the way the settings form speaks.
//
// formatBytes in api.ts rounds to one decimal for display next to a file list.
// A limit is different: it is a number the user will compare against a number the
// server enforces, so it is shown exactly, and never as "0 B" for a limit that is
// really "no limit".
export function describeSize(bytes: number): string {
  if (bytes <= 0) {
    return "No limit";
  }
  const parts = sizeToParts(bytes);
  const amount = Number(parts.amount);
  const rounded = Number.isInteger(amount) ? amount : amount.toFixed(2);
  return `${rounded} ${parts.unit}`;
}
