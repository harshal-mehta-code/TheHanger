"use client";

import { useState } from "react";
import Modal from "./Modal";
import { CheckIcon, CloudIcon, SparkleIcon } from "./Icons";
import { useAuth } from "@/lib/auth";
import { useCloset } from "@/lib/store";

type Mode = "signIn" | "signUp";

function friendly(message: string) {
  if (/invalid login credentials/i.test(message))
    return "That email and password don't match an account.";
  if (/already registered|already been registered/i.test(message))
    return "There's already an account with that email — try signing in.";
  if (/password should be at least/i.test(message))
    return "Passwords need to be at least 6 characters.";
  if (/rate limit|too many/i.test(message))
    return "Too many attempts just now. Give it a minute.";
  if (/failed to fetch|networkerror/i.test(message))
    return "Couldn't reach the server. Check your connection.";
  return message;
}

export default function AccountSheet({ onClose }: { onClose: () => void }) {
  const { enabled, email, userId, signIn, signUp, signOut, resetPassword } =
    useAuth();
  const { items, outfits, syncState, syncNow } = useCloset();

  const [mode, setMode] = useState<Mode>("signIn");
  const [emailInput, setEmailInput] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!enabled) {
    return (
      <Modal title="Sync across devices" onClose={onClose}>
        <div className="space-y-3 p-5">
          <p className="text-sm leading-relaxed text-ink-soft">
            This copy of The Hanger doesn&apos;t have a cloud project connected,
            so your closet lives only in this browser.
          </p>
          <p className="text-sm leading-relaxed text-muted">
            To turn on accounts and sync, add a Supabase project and set{" "}
            <code className="rounded bg-bone px-1 py-0.5 text-xs">
              NEXT_PUBLIC_SUPABASE_URL
            </code>{" "}
            and{" "}
            <code className="rounded bg-bone px-1 py-0.5 text-xs">
              NEXT_PUBLIC_SUPABASE_ANON_KEY
            </code>
            . The steps are in the project README.
          </p>
          <p className="text-sm leading-relaxed text-muted">
            Until then, the backup and restore options in the settings menu move
            a closet between devices by hand.
          </p>
        </div>
      </Modal>
    );
  }

  /* ---------------- signed in ---------------- */

  if (userId) {
    const syncing = syncState.status === "syncing";
    return (
      <Modal title="Your account" onClose={onClose}>
        <div className="space-y-5 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-berry-soft text-berry">
              <CheckIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{email}</p>
              <p className="text-xs text-muted">
                {items.length} pieces · {outfits.length}{" "}
                {outfits.length === 1 ? "look" : "looks"} synced to this account
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-line p-4">
            <div className="flex items-center gap-2">
              <CloudIcon
                className={`h-4 w-4 ${
                  syncState.status === "error" ? "text-berry" : "text-sage"
                }`}
              />
              <p className="text-sm font-medium">
                {syncing
                  ? "Syncing…"
                  : syncState.status === "error"
                    ? "Sync needs attention"
                    : "Up to date"}
              </p>
              <button
                type="button"
                onClick={() => void syncNow()}
                disabled={syncing}
                className="btn-ghost ml-auto py-1.5 text-xs disabled:opacity-55"
              >
                Sync now
              </button>
            </div>
            {syncState.message && (
              <p className="mt-2 text-xs text-muted">{syncState.message}</p>
            )}
            {syncState.lastSyncedAt && !syncState.message && (
              <p className="mt-2 text-xs text-muted">
                Last synced{" "}
                {new Date(syncState.lastSyncedAt).toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>

          <p className="text-xs leading-relaxed text-muted">
            Sign in with the same email on another device and the whole closet —
            photos included — comes with you. Signing out here leaves this
            device&apos;s copy exactly as it is.
          </p>

          <button
            type="button"
            onClick={async () => {
              setBusy(true);
              await signOut();
              onClose();
            }}
            disabled={busy}
            className="btn-ghost w-full justify-center disabled:opacity-55"
          >
            Sign out
          </button>
        </div>
      </Modal>
    );
  }

  /* ---------------- signed out ---------------- */

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProblem(null);
    setNotice(null);

    if (!emailInput.trim() || !password) {
      setProblem("Email and password, please.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signUp") {
        const { needsConfirmation } = await signUp(emailInput, password);
        if (needsConfirmation) {
          setNotice(
            "Account created. Check your email for a confirmation link, then sign in.",
          );
          setMode("signIn");
          setPassword("");
          return;
        }
      } else {
        await signIn(emailInput, password);
      }
      onClose();
    } catch (err) {
      setProblem(friendly(err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={mode === "signUp" ? "Create an account" : "Sign in"}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        <p className="text-sm leading-relaxed text-muted">
          {mode === "signUp"
            ? "One account keeps the same closet on your phone and your laptop. Anything already on this device comes with you."
            : "Sign in to bring this closet in step with your other devices."}
        </p>

        <div>
          <label className="label" htmlFor="acc-email">
            Email
          </label>
          <input
            id="acc-email"
            type="email"
            autoComplete="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="you@example.com"
            className="field"
          />
        </div>

        <div>
          <label className="label" htmlFor="acc-password">
            Password
          </label>
          <input
            id="acc-password"
            type="password"
            autoComplete={mode === "signUp" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signUp" ? "At least 6 characters" : "••••••••"}
            className="field"
          />
        </div>

        {problem && (
          <p role="alert" className="text-sm font-medium text-berry">
            {problem}
          </p>
        )}
        {notice && (
          <p role="status" className="text-sm font-medium text-sage">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="btn-primary w-full justify-center disabled:opacity-55"
        >
          {busy ? (
            "One moment…"
          ) : mode === "signUp" ? (
            <>
              <SparkleIcon className="h-4 w-4" />
              Create account
            </>
          ) : (
            "Sign in"
          )}
        </button>

        <div className="flex items-center justify-between gap-3 text-xs">
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signUp" ? "signIn" : "signUp");
              setProblem(null);
              setNotice(null);
            }}
            className="font-medium text-berry underline-offset-4 hover:underline"
          >
            {mode === "signUp"
              ? "I already have an account"
              : "Create an account"}
          </button>

          {mode === "signIn" && (
            <button
              type="button"
              onClick={async () => {
                if (!emailInput.trim()) {
                  setProblem("Enter your email first, then tap reset.");
                  return;
                }
                try {
                  await resetPassword(emailInput);
                  setNotice("Password reset link sent.");
                } catch (err) {
                  setProblem(
                    friendly(err instanceof Error ? err.message : String(err)),
                  );
                }
              }}
              className="text-muted underline-offset-4 hover:underline"
            >
              Forgot password
            </button>
          )}
        </div>

        <p className="border-t border-line pt-4 text-xs leading-relaxed text-muted">
          Your closet stays private to your account. Photos are stored in a
          private bucket only you can read.
        </p>
      </form>
    </Modal>
  );
}
