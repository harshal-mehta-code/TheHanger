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
  onQuickAdd?: () => void;
  searchRef?: React.RefObject<HTMLInputElement | null>;
}

const TABS = [
  { href: "/", label: "Closet" },
  { href: "/outfits", label: "Outfits" },
  { href: "/inspo", label: "Inspo" },
  { href: "/plan", label: "Plan" },
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
    <header className="sticky top-0 z-30 -mx-4 mb-4 border-b border-bar-line bg-bar px-4 pb-3 pt-4 text-bar-ink sm:-mx-6 sm:px-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage-bright text-on-bright sm:h-10 sm:w-10">
            <HangerMark className="animate-swing h-5 w-5 sm:h-6 sm:w-6" />
          </span>
          <span className="min-w-0">
            <span className="display block truncate text-lg font-semibold leading-none sm:text-2xl">
              The Hanger
            </span>
            {subtitle && (
              <span className="mt-1 hidden text-xs text-bar-ink/70 lg:block">
                {subtitle}
              </span>
            )}
          </span>
        </Link>

        {/* Sections live in the header on a laptop and in the bottom bar on a
            phone, so the top of a small screen stays mostly clothes. */}
        <nav
          aria-label="Sections"
          className="mx-auto hidden shrink-0 gap-1 rounded-full border border-bar-line bg-bar-ink/10 p-1 sm:flex"
        >
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors lg:px-4 ${
                  active
                    ? "bg-berry-bright text-on-bright"
                    : "text-bar-ink/75 hover:bg-bar-ink/10 hover:text-bar-ink"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:ml-0">
          {search && (
            <div className="relative hidden md:block">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                ref={searchRef}
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                placeholder={search.placeholder}
                aria-label={search.placeholder}
                className="field w-44 rounded-full pl-9 lg:w-60"
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

      {search && (
        <div className="relative mt-3 md:hidden">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder}
            aria-label={search.placeholder}
            className="field rounded-full pl-9"
          />
        </div>
      )}
    </header>
  );
}
