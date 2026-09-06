"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "./Icons";

interface Props {
  onClose: () => void;
  title: string;
  /** Visually hide the header title but keep it for screen readers. */
  hideTitle?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}

export default function Modal({
  onClose,
  title,
  hideTitle,
  children,
  footer,
  wide,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    // Move focus into the dialog so keyboard and screen-reader users land here.
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  // Rendered through the body, not in place. An ancestor with backdrop-filter
  // (the sticky header, for one) becomes the containing block for fixed
  // children, which would anchor this sheet to the header instead of the
  // viewport and push it off screen.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="animate-fade absolute inset-0 bg-ink/45 backdrop-blur-[3px]"
        onClick={onClose}
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        className={`animate-sheet relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-shell shadow-[var(--shadow-sheet)] outline-none sm:max-h-[88dvh] sm:rounded-3xl ${
          wide ? "sm:max-w-4xl" : "sm:max-w-lg"
        }`}
      >
        {hideTitle ? (
          // The content supplies its own heading, so the bar would just be a
          // band of empty white — float the close button over it instead.
          <>
            <h2 className="sr-only">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-shell/80 text-muted backdrop-blur-sm transition-colors hover:bg-bone hover:text-ink"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </>
        ) : (
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <h2 className="display text-lg font-semibold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="ml-auto flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-bone hover:text-ink"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </header>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>

        {footer && (
          <footer className="shrink-0 border-t border-line bg-shell px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
