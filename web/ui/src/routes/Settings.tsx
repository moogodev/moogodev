import { useCallback, useEffect, useState } from "react";
import { api, ApiError, formatBytes, type Me } from "../lib/api";
import { PasswordInput } from "../components/PasswordInput";

export default function Settings() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((account) => {
        if (!cancelled) setMe(account);
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof ApiError ? cause.message : "Could not load your account.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function signOut() {
    try {
      await api.logout();
    } finally {
      window.location.assign("/");
    }
  }

  return (
    <div className="page-shell">
      <header className="mb-10">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-[0.85rem] text-muted">Your account and plan.</p>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-6 mx-auto max-w-3xl rounded-md border border-amber/40 bg-amber/10 px-4 py-3 text-[0.85rem] text-amber"
        >
          {error}
        </div>
      )}

      <main className="space-y-10">
        <AccountSection me={me} loading={loading} onRefresh={() => api.me().then(setMe).catch(() => {})} />

        {me?.has_password === false ? <GooglePasswordNote /> : <PasswordForm />}

        <PlanSection me={me} loading={loading} />

        <SessionSection onSignOut={signOut} />
      </main>
    </div>
  );
}

function AccountSection({ me, loading, onRefresh }: { me: Me | null; loading: boolean; onRefresh: () => void }) {
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(me?.user.name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = () => {
    setNameInput(me?.user.name ?? "");
    setEditingName(true);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingName(false);
    setError(null);
  };

  const saveName = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await api.updateProfile({ name: nameInput.trim() });
      await onRefresh();
      setEditingName(false);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not update name.");
    } finally {
      setBusy(false);
    }
  }, [nameInput, onRefresh]);

  return (
    <section className="mx-auto max-w-3xl rounded-lg border border-edge bg-panel p-5">
      <h2 className="mb-4 text-[0.95rem] font-semibold text-foreground">Account</h2>
      <dl className="space-y-1 text-[0.86rem]">
        <Row
          label="Name"
          value={loading ? "…" : me?.user.name ?? "—"}
          readOnly
          action={
            editingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveName()}
                  onBlur={cancelEdit}
                  autoFocus
                  className="flex-1 min-w-[120px] rounded-lg border border-edge bg-background px-3 py-1.5 text-[0.86rem] font-medium text-foreground placeholder:text-faint focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
                <button
                  type="button"
                  onClick={saveName}
                  disabled={busy || nameInput.trim() === ""}
                  className="cursor-pointer rounded-lg bg-accent-strong px-3 py-1.5 text-[0.8rem] font-semibold text-accent-ink transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={busy}
                  className="cursor-pointer rounded-lg border border-edge-strong px-3 py-1.5 text-[0.8rem] font-medium text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={startEdit}
                className="cursor-pointer text-[0.75rem] font-medium text-muted hover:text-foreground transition-colors"
              >
                Edit
              </button>
            )
          }
        />
        <Row label="Email" value={loading ? "…" : me?.user.email ?? "—"} readOnly />
      </dl>
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-[0.82rem] text-amber"
        >
          {error}
        </p>
      )}
      <p className="mt-4 max-w-[62ch] text-[0.8rem] font-medium leading-relaxed text-muted">
        The email is how Moogo recognises you, so it is shown for reference and
        cannot be changed here. It has to match the address on your Google
        account, otherwise signing in with Google would create a second account.
      </p>
    </section>
  );
}

// GooglePasswordNote explains an account that has no Moogo password.
function GooglePasswordNote() {
  return (
    <section className="mx-auto max-w-3xl rounded-lg border border-edge bg-panel p-5">
      <h2 className="mb-4 text-[0.95rem] font-semibold text-foreground">Password</h2>
      <div className="space-y-3">
        <p className="text-[0.86rem] font-semibold">Your password is managed by Google</p>
        <p className="max-w-[62ch] text-[0.8rem] font-medium leading-relaxed text-muted">
          This account signs in with Google, so Moogo has never seen a password
          for it and cannot change one. To change or reset it, use your Google
          account — the same password you use for Gmail.
        </p>
        <a
          href="https://myaccount.google.com/security"
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-edge-strong px-4 py-2 text-[0.85rem] font-semibold text-foreground transition-colors hover:border-hover-edge hover:bg-hover-bg"
        >
          Open Google account security
        </a>
      </div>
    </section>
  );
}

// PasswordForm replaces the password for an account that has one.
function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const reset = useCallback(() => {
    setCurrent("");
    setNext("");
    setConfirm("");
  }, []);

  const submit = useCallback(async () => {
    if (next !== confirm) {
      setError("The two new passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      await api.changePassword({ current_password: current, new_password: next });
      reset();
      setDone(true);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not update the password.");
    } finally {
      setBusy(false);
    }
  }, [confirm, current, next, reset]);

  return (
    <section className="mx-auto max-w-3xl rounded-lg border border-edge bg-panel p-5">
      <h2 className="mb-4 text-[0.95rem] font-semibold text-foreground">Password</h2>
      <div className="max-w-[26rem] space-y-4">
        <Field label="Current password" id="current-password">
          <PasswordInput
            id="current-password"
            value={current}
            onChange={setCurrent}
            autoComplete="current-password"
          />
        </Field>
        <Field label="New password" id="new-password">
          <PasswordInput
            id="new-password"
            value={next}
            onChange={setNext}
            autoComplete="new-password"
          />
        </Field>
        <Field label="Confirm new password" id="confirm-password">
          <PasswordInput
            id="confirm-password"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
          />
        </Field>
      </div>
      <p className="mt-3 text-[0.8rem] font-medium text-muted">
        At least 8 characters. Your other sessions stay signed in.
      </p>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || current === "" || next === ""}
          className="cursor-pointer rounded-lg bg-accent-strong px-4 py-2 text-[0.85rem] font-semibold text-accent-ink transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Saving…" : "Change password"}
        </button>
        {done && (
          <span role="status" className="text-[0.82rem] font-medium text-muted">
            Password updated.
          </span>
        )}
      </div>
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-[0.82rem] text-amber"
        >
          {error}
        </p>
      )}
    </section>
  );
}

function PlanSection({ me, loading }: { me: Me | null; loading: boolean }) {
  return (
    <section className="mx-auto max-w-3xl rounded-lg border border-edge bg-panel p-5">
      <h2 className="mb-4 text-[0.95rem] font-semibold text-foreground">Plan</h2>
      <dl className="space-y-1 text-[0.86rem] mb-5">
        <Row label="Plan" value={loading ? "…" : planLabel(me?.plan)} />
        <Row
          label="Projects"
          value={loading ? "…" : `${me?.usage.project_count ?? 0} of ${me?.max_projects ?? 2}`}
        />
        <Row
          label="Database limit"
          value={loading ? "…" : `${formatBytes(me?.max_db_bytes ?? 0)} per project`}
        />
        <Row label="Bucket limit" value="256 MB per project" />
      </dl>

      <div className="rounded-lg border border-edge bg-background p-4">
        <p className="text-[0.86rem] font-semibold">Need more than the free plan?</p>
        <p className="mt-1 max-w-[62ch] text-[0.8rem] font-medium leading-relaxed text-muted">
          Bigger project limits and more storage are coming. Nothing is charged
          today — every account is on the free plan.
        </p>
        <a
          href="/plan"
          className="mt-3 inline-block cursor-pointer rounded-lg bg-accent-strong px-4 py-2 text-[0.85rem] font-semibold text-accent-ink transition-colors hover:bg-accent"
        >
          See plans
        </a>
      </div>
    </section>
  );
}

function SessionSection({ onSignOut }: { onSignOut: () => void }) {
  return (
    <section className="mx-auto max-w-3xl rounded-lg border border-edge bg-panel p-5">
      <h2 className="mb-4 text-[0.95rem] font-semibold text-foreground">Session</h2>
      <button
        type="button"
        onClick={onSignOut}
        className="cursor-pointer rounded-lg border border-error/30 bg-error/5 px-4 py-2 text-[0.85rem] font-medium text-error transition-colors hover:bg-error/10 hover:border-error"
      >
        Sign out
      </button>
    </section>
  );
}

function planLabel(plan: string | undefined): string {
  if (!plan) return "—";
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-[0.8rem] font-semibold text-foreground"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  readOnly,
  action,
}: {
  label: string;
  value: string;
  readOnly?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-edge py-3">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 truncate font-medium flex items-center gap-3">
        {readOnly ? (
          <span title={`${label} cannot be changed here`} className="block truncate">
            {value}
          </span>
        ) : (
          value
        )}
        {action}
      </dd>
    </div>
  );
}