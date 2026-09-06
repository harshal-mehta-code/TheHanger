"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SettingsMenu from "./SettingsMenu";
import { HangerMark, PlusIcon, SearchIcon } from "./Icons";

interface Props {
  /** Search is contextual — omit it on views that don't have a grid to filter. */
  search?: { value: string; onChange: (v: string) => void; placeholder: string };
  /** Views without something to add (Insights) leave both of these out. */
  addLabel?: string;
  onAdd?: () => void;
  subtitle?: string;
  onNotify: (message: string) => void;
  /** Offered alongside backup/restore in the settings menu. */
  onQuickAdd?: () => void;
  searchRef?: React.RefObject<HTMLInputElement | null>;
}

const TABS = [
  { href: "/", label: "Closet" },
  { href: "/outfits", label: "Outfits" },
  { href: "/insights", label: "Insights" },
];

export default function AppHeader({
  search,
  addLabel,
  onAdd,
  subtitle,
  onNotify,
  onQuickAdd,
  searchRef,
}: Props) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 -mx-4 mb-5 bg-bone/85 px-4 pb-3 pt-4 backdrop-blur-md sm:-mx-6 sm:px-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-bone">
            <HangerMark className="animate-swing h-6 w-6" />
          </span>
          <span className="min-w-0">
            <span className="display block truncate text-xl font-semibold leading-none sm:text-2xl">
              The Hanger
            </span>
            {subtitle && (
              <span className="mt-1 hidden text-xs text-muted lg:block">
                {subtitle}
              </span>
            )}
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          {search && (
            <div className="relative hidden sm:block">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                ref={searchRef}
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                placeholder={search.placeholder}
                aria-label={search.placeholder}
                className="field w-48 rounded-full pl-9 lg:w-64"
              />
            </div>
          )}

          <SettingsMenu onNotify={onNotify} onQuickAdd={onQuickAdd} />

          {onAdd && (
            <button type="button" onClick={onAdd} className="btn-primary">
              <PlusIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{addLabel}</span>
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <nav
          aria-label="Sections"
          className="flex shrink-0 gap-1 rounded-full border border-line bg-shell p-1"
        >
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors sm:px-4 ${
                  active
                    ? "bg-ink text-bone"
                    : "text-ink-soft hover:text-berry-deep"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {search && (
          <div className="relative min-w-0 flex-1 sm:hidden">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              placeholder="Search…"
              aria-label={search.placeholder}
              className="field rounded-full pl-9"
            />
          </div>
        )}
      </div>
    </header>
  );
}
