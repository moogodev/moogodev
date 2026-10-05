// BucketSettingsPage is the standalone page for one bucket's settings.
//
// It replaced a modal. A modal put four settings and a policy in a dialog over
// the object table, which had two costs: the settings were unreachable from the
// URL, so they could not be linked to or reloaded into, and a dialog is sized to
// its content, so adding a seventh file type meant growing it past the point
// where it covered the thing it was describing.
//
// The bucket being edited is named in the query string rather than held in
// component state. That makes the page linkable from the object browser's
// "Bucket settings" button and survives a reload.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  api,
  ApiError,
  type Bucket,
  type BucketAllowedTypes,
} from "../lib/api";
import { describePolicy, MEDIA_CLASSES } from "../lib/media";
import {
  describeSize,
  partsToBytes,
  sizeToParts,
  type SizeParts,
  type SizeUnit,
} from "../lib/sizes";

interface BucketSettingsPageProps {
  projectId: string;
}

// Draft is the form's own copy of the settings, in the units the page speaks.
//
// It is kept apart from the bucket because the two differ in shape: bytes become
// an amount plus a unit, and the policy becomes a set. Writing edits straight back
// onto the bucket would mean converting on every keystroke and would make typing
// "2" in a MB field rewrite the unit under the cursor.
interface Draft {
  isPublic: boolean;
  allowed: BucketAllowedTypes[];
  maxSize: SizeParts;
}

function draftFor(bucket: Bucket): Draft {
  return {
    isPublic: bucket.is_public,
    // A bucket whose policy column predates the array reads as an empty set, which
    // the dashboard shows the same way the server enforces it: no restriction.
    allowed: bucket.allowed_types.length === 0 ? ["any"] : [...bucket.allowed_types],
    maxSize: sizeToParts(bucket.max_object_size_bytes),
  };
}

export default function BucketSettingsPage({ projectId }: BucketSettingsPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [buckets, setBuckets] = useState<Bucket[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const selectedName = searchParams.get("bucket");
  const bucket = useMemo(
    () => buckets?.find((item) => item.name === selectedName) ?? buckets?.[0] ?? null,
    [buckets, selectedName],
  );

  const load = useCallback(async () => {
    try {
      const response = await api.dashboardBuckets(projectId);
      setBuckets(response.buckets);
      setLoadError(null);
    } catch (cause) {
      setBuckets([]);
      setLoadError(messageOf(cause));
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  // The draft follows the selected bucket. Without this, switching buckets would
  // show the previous bucket's settings and save them over the new one, which is
  // the sort of mistake a settings page cannot afford to make look plausible.
  //
  // It deliberately leaves the saved flag alone. This effect also runs after a
  // save, because the response replaces the bucket, and clearing the flag here
  // would erase the confirmation the moment it appeared.
  useEffect(() => {
    setDraft(bucket ? draftFor(bucket) : null);
    setFormError(null);
  }, [bucket]);

  const chooseBucket = useCallback(
    (name: string) => {
      // Choosing a different bucket is a change of subject, so whatever was saved
      // or refused belongs to the one being left behind.
      setSaved(false);
      setFormError(null);
      setSearchParams({ bucket: name }, { replace: true });
    },
    [setSearchParams],
  );

  const toggleClass = useCallback((option: BucketAllowedTypes) => {
    setSaved(false);
    setDraft((current) => {
      if (current === null) return current;

      // "any" is the absence of a restriction, so it cannot sit beside a class:
      // checking it replaces whatever was selected, and unchecking it leaves an
      // empty set that the page renders as an error rather than silently meaning
      // "accept nothing".
      if (option === "any") {
        return { ...current, allowed: current.allowed.includes("any") ? [] : ["any"] };
      }
      // Clicking a specific type while "any" is selected should switch to that type.
      // Otherwise toggle the specific type.
      const hasOption = current.allowed.includes(option);
      const withoutAny = current.allowed.filter((entry) => entry !== "any");
      if (hasOption) {
        return { ...current, allowed: withoutAny.filter((entry) => entry !== option) };
      }
      return { ...current, allowed: [...withoutAny, option] };
    });
  }, []);

  const setPart = useCallback(
    (field: "maxSize", part: keyof SizeParts, value: string) => {
      setSaved(false);
      setFormError(null);
      setDraft((current) =>
        current === null ? current : { ...current, [field]: { ...current[field], [part]: value } },
      );
    },
    [],
  );

  const setPublic = useCallback((isPublic: boolean) => {
    setSaved(false);
    setDraft((current) => (current === null ? current : { ...current, isPublic }));
  }, []);

  const save = useCallback(async () => {
    if (bucket === null || draft === null) {
      return;
    }
    if (draft.allowed.length === 0) {
      setFormError("Pick at least one file type, or choose “Any file”.");
      return;
    }
    const maxSize = partsToBytes(draft.maxSize);
    if (maxSize === null) {
      setFormError("That size has to be a number.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const response = await api.dashboardUpdateBucketSettings(projectId, bucket.id, {
        allowed_types: draft.allowed,
        max_object_size_bytes: maxSize,
        is_public: draft.isPublic,
      });
      setBuckets((current) =>
        current?.map((item) => (item.id === response.bucket.id ? response.bucket : item)) ?? current,
      );
      setSaved(true);
    } catch (cause) {
      setFormError(messageOf(cause));
    } finally {
      setSaving(false);
    }
  }, [bucket, draft, projectId]);

  if (loadError) {
    return (
      <p role="alert" className="rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-amber">
        {loadError}
      </p>
    );
  }

  if (buckets === null) {
    return <p className="text-muted">Loading buckets…</p>;
  }

  if (buckets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-edge px-6 py-12 text-center">
        <p className="text-lg font-semibold">No buckets yet</p>
        <p className="mt-1 text-muted">Create one on the Bucket tab first.</p>
        <Link
          to={`/app/projects/${projectId}/bucket`}
          className="mt-5 inline-block cursor-pointer rounded-lg bg-accent-strong px-4 py-2 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent"
        >
          Go to Bucket
        </Link>
      </div>
    );
  }

  if (bucket === null || draft === null) {
    return <p className="text-muted">Loading buckets…</p>;
  }

  // Both hints below read the amount field back rather than the draft value, so
  // they follow what the user is typing instead of what was last saved. A 0 here
  // is the wire value for "no cap", so it is spelled out rather than left to
  // describeSize, whose "No limit" belongs to a quota of zero rather than a limit.
  const maxBytes = partsToBytes(draft.maxSize);
  const maxSizeHint =
    maxBytes === 0
      ? "No per-file limit. An upload is bounded by the bucket quota instead."
      : maxBytes === null
        ? "That has to be a number."
        : `Files over ${describeSize(maxBytes)} are refused.`;

  return (
    <div className="space-y-5">
      {/* Which bucket. A select rather than a list of links because the point of
          the page is editing, not navigating: the bucket under the cursor is the
          subject, and switching subject should not look like leaving the page. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Bucket settings</h2>
          <p className="mt-0.5 text-sm text-muted">
            These apply to <span className="font-mono text-foreground">{bucket.name}</span> and
            are enforced on every upload, not just the ones from this dashboard.
          </p>
        </div>
        <select
          value={bucket.name}
          onChange={(event) => chooseBucket(event.target.value)}
          aria-label="Bucket to edit"
          className="cursor-pointer rounded-lg border border-edge-strong bg-panel px-3 py-2 text-sm text-foreground"
        >
          {buckets.map((item) => (
            <option key={item.id} value={item.name}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      <section className="rounded-xl border border-edge bg-panel p-5">
        <SectionHeading>Visibility</SectionHeading>
        <p className="mt-2 max-w-[68ch] text-[0.82rem] font-medium leading-relaxed text-muted">
          This is the default for new uploads. Turning a bucket off makes the objects already in
          it private as well — each file can then be published again on its own from the Bucket
          tab. Replacing an existing file never changes its visibility either way.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <VisibilityOption
            chosen={draft.isPublic}
            onChoose={() => setPublic(true)}
            title="Public"
            detail="New uploads are reachable by their URL without a credential."
          />
          <VisibilityOption
            chosen={!draft.isPublic}
            onChoose={() => setPublic(false)}
            title="Private"
            detail="New uploads need the bucket credential to read."
          />
        </div>
      </section>

      <section className="rounded-xl border border-edge bg-panel p-5">
        <SectionHeading>Allowed file types</SectionHeading>
        <p className="mt-2 max-w-[68ch] text-[0.82rem] font-medium leading-relaxed text-muted">
          Check every kind of file this bucket should take. Anything outside the selection is
          refused at upload time. Currently accepts {describePolicy(draft.allowed)}.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {MEDIA_CLASSES.map((entry) => {
            const checked = draft.allowed.includes(entry.id);
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => toggleClass(entry.id)}
                className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors text-left w-full ${
                  checked
                    ? "border-accent-strong bg-accent-strong/5"
                    : "border-edge hover:border-edge-strong hover:bg-hover-bg"
                }`}
              >
                <span
                  className={`mt-0.5 h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                    checked
                      ? "border-accent-strong bg-accent-strong text-accent-ink"
                      : "border-edge-strong bg-transparent text-transparent"
                  }`}
                >
                  {checked && (
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3">
                      <path d="M3 8l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{entry.label}</span>
                  <span className="mt-0.5 block text-xs font-medium leading-relaxed text-muted">
                    {entry.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-edge bg-panel p-5">
        <SectionHeading>Limits</SectionHeading>
        <div className="mt-4 flex items-end gap-4 flex-wrap">
          <SizeField
            label="Maximum file size"
            parts={draft.maxSize}
            onChange={(part, value) => setPart("maxSize", part, value)}
            // 0 is the wire value for "no per-file cap", so an empty field is a
            // real setting here rather than an incomplete one.
            hint={maxSizeHint}
          />
          <div className="flex-1 min-w-[240px] flex items-center gap-3 px-3 py-2 text-sm font-medium text-muted rounded-lg bg-background border border-edge">
            <span>Every bucket shares the project-wide storage limit from your plan.</span>
            <a
              href="/plan"
              className="ml-auto cursor-pointer rounded-lg bg-accent-strong px-3 py-1.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent whitespace-nowrap"
            >
              See our pricing
            </a>
          </div>
        </div>
      </section>

      {formError && (
        <p
          role="alert"
          className="rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-amber"
        >
          {formError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="cursor-pointer rounded-lg bg-accent-strong px-4 py-2 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        <Link
          to={`/app/projects/${projectId}/bucket`}
          className="cursor-pointer rounded-lg border border-edge-strong px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground"
        >
          Back to Bucket
        </Link>
        {saved && (
          <span role="status" className="text-sm font-medium text-muted">
            Saved.
          </span>
        )}
      </div>
    </div>
  );
}

// SizeField is an amount and a unit side by side.
//
// The two are separate controls because a bare number cannot say which unit it
// is in, and a select of units with no number next to it is a setting nobody can
// read. Together they also make the conversion explicit instead of hiding it
// behind a menu of "small / large".
function SizeField({
  label,
  parts,
  onChange,
  hint,
}: {
  label: string;
  parts: SizeParts;
  onChange: (part: keyof SizeParts, value: string) => void;
  hint: string;
}) {
  return (
    <div className="max-w-[280px]">
      <label className="block text-sm font-semibold text-foreground">{label}</label>
      <div className="mt-2 flex items-stretch">
        <input
          type="number"
          min={0}
          step={1}
          value={parts.amount}
          onChange={(event) => onChange("amount", event.target.value)}
          placeholder="0"
          aria-label={label}
          className="w-[90px] min-w-0 rounded-l-lg border border-edge-strong bg-background px-3 py-2 text-sm text-foreground focus:border-accent-strong"
        />
        <select
          value={parts.unit}
          onChange={(event) => onChange("unit", event.target.value as SizeUnit)}
          aria-label={`${label} unit`}
          className="cursor-pointer w-[70px] rounded-r-lg border border-l-0 border-edge-strong bg-panel px-2 py-2 text-sm text-foreground"
        >
          <option value="KB">KB</option>
          <option value="MB">MB</option>
        </select>
      </div>
      <p className="mt-1.5 text-xs font-medium leading-relaxed text-muted">{hint}</p>
    </div>
  );
}

function VisibilityOption({
  chosen,
  onChoose,
  title,
  detail,
}: {
  chosen: boolean;
  onChoose: () => void;
  title: string;
  detail: string;
}) {
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${
        chosen
          ? "border-accent-strong bg-accent-strong/5"
          : "border-edge hover:border-edge-strong hover:bg-hover-bg"
      }`}
    >
      {/* A radio, because these are alternatives: picking Private has to clear
          Public, which a pair of checkboxes would not do on its own. */}
      <input
        type="radio"
        checked={chosen}
        onChange={onChoose}
        aria-label={title}
        className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent-strong)]"
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-xs font-medium leading-relaxed text-muted">{detail}</span>
      </span>
    </label>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-bold uppercase tracking-wider text-faint">{children}</h3>
  );
}

function messageOf(cause: unknown): string {
  return cause instanceof ApiError ? cause.message : "Something went wrong.";
}
