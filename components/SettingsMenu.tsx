"use client";

import { useEffect, useRef, useState } from "react";
import {
  CameraIcon,
  CloudIcon,
  DownloadIcon,
  MoonIcon,
  SunIcon,
  SlidersIcon,
  SparkleIcon,
  TrashIcon,
  UploadIcon,
} from "./Icons";
import { useCloset } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import AccountSheet from "./AccountSheet";

interface Props {
  onNotify: (message: string) => void;
  onQuickAdd?: () => void;
}

export default function SettingsMenu({ onNotify, onQuickAdd }: Props) {
  const { items, exportBackup, importBackup, seedSample, resetCloset, syncState } =
    useCloset();
  const [open, setOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dark, setDark] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const { enabled: cloudOn, email, userId } = useAuth();
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("hanger-theme", next);
    } catch {
      // Private browsing can refuse storage; the theme still applies for now.
    }
    setDark(next === "dark");
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setConfirmReset(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setConfirmReset(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function close() {
    setOpen(false);
    setConfirmReset(false);
  }

  async function handleImport(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const count = await importBackup(file);
      onNotify(`Restored ${count} ${count === 1 ? "piece" : "pieces"}.`);
      close();
    } catch {
      onNotify("That file couldn't be read as a Hanger backup.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSample() {
    setBusy(true);
    try {
      const count = await seedSample();
      onNotify(`Added ${count} sample pieces to explore.`);
      close();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => {
          // The pre-paint script in the layout owns the theme; read it back on
          // open so the label matches what's actually on screen.
          if (!open) setDark(document.documentElement.dataset.theme === "dark");
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Closet settings"
        className="btn-ghost px-3"
      >
        <SlidersIcon className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="menu"
          className="animate-rise card-surface absolute right-0 top-[calc(100%+0.5rem)] z-40 w-64 overflow-hidden p-1.5 shadow-[var(--shadow-lift)]"
        >
          <MenuItem
            icon={<CloudIcon className="h-4 w-4" />}
            label={userId ? "Account & sync" : cloudOn ? "Sign in to sync" : "Sync across devices"}
            hint={
              userId
                ? syncState.status === "error"
                  ? "Sync needs attention"
                  : (email ?? "Synced to your account")
                : "Keep the same closet on every device"
            }
            onClick={() => {
              setAccountOpen(true);
              close();
            }}
          />

          <div className="my-1 border-t border-line" />

          {onQuickAdd && (
            <>
              <MenuItem
                icon={<CameraIcon className="h-4 w-4" />}
                label="Quick add from photos"
                hint="Catalogue a batch in one pass"
                onClick={() => {
                  onQuickAdd();
                  close();
                }}
              />
              <div className="my-1 border-t border-line" />
            </>
          )}

          <MenuItem
            icon={<DownloadIcon className="h-4 w-4" />}
            label="Back up closet"
            hint="Download a JSON with photos"
            disabled={items.length === 0 || busy}
            onClick={async () => {
              await exportBackup();
              onNotify("Backup downloaded.");
              close();
            }}
          />

          <MenuItem
            icon={<UploadIcon className="h-4 w-4" />}
            label="Restore from backup"
            hint="Adds to what's already here"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          />

          {items.length === 0 && (
            <MenuItem
              icon={<SparkleIcon className="h-4 w-4" />}
              label="Load a sample closet"
              hint="See how it feels with pieces in it"
              disabled={busy}
              onClick={handleSample}
            />
          )}

          <MenuItem
            icon={
              dark ? (
                <SunIcon className="h-4 w-4" />
              ) : (
                <MoonIcon className="h-4 w-4" />
              )
            }
            label={dark ? "Switch to light" : "Switch to dark"}
            hint={dark ? "Cream and ink" : "Easier on the eyes at night"}
            onClick={toggleTheme}
          />

          <div className="my-1 border-t border-line" />

          {confirmReset ? (
            <div className="p-2">
              <p className="text-xs leading-relaxed text-muted">
                {userId
                  ? "This erases every piece and photo from your account, on all your devices. Back up first if you want them back."
                  : "This erases every piece and photo on this device. Back up first if you want them back."}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="btn-ghost flex-1 py-1.5 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await resetCloset();
                    onNotify("Closet emptied.");
                    close();
                  }}
                  className="btn-primary flex-1 bg-berry-deep py-1.5 text-xs hover:bg-berry"
                >
                  Erase
                </button>
              </div>
            </div>
          ) : (
            <MenuItem
              icon={<TrashIcon className="h-4 w-4" />}
              label="Empty the closet"
              hint={userId ? "Deletes everything, everywhere" : "Deletes everything on this device"}
              danger
              disabled={items.length === 0 || busy}
              onClick={() => setConfirmReset(true)}
            />
          )}

          <p className="px-3 py-2 text-[11px] leading-relaxed text-muted">
            {userId
              ? "Your closet is stored in this browser and synced privately to your account."
              : "Your closet is stored privately in this browser — nothing is uploaded anywhere."}
          </p>
        </div>
      )}

      {accountOpen && <AccountSheet onClose={() => setAccountOpen(false)} />}

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          void handleImport(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function MenuItem({
  icon,
  label,
  hint,
  onClick,
  disabled,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left transition-colors disabled:opacity-40 ${
        danger ? "hover:bg-berry-soft" : "hover:bg-bone"
      }`}
    >
      <span className={`mt-0.5 ${danger ? "text-berry" : "text-muted"}`}>
        {icon}
      </span>
      <span className="min-w-0">
        <span
          className={`block text-sm font-medium ${danger ? "text-berry-deep" : ""}`}
        >
          {label}
        </span>
        {hint && <span className="block text-[11px] text-muted">{hint}</span>}
      </span>
    </button>
  );
}
