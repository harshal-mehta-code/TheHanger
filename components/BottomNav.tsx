"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HangerMark, SparkleIcon, ChartIcon } from "./Icons";

const TABS = [
  { href: "/", label: "Closet", Icon: HangerMark },
  { href: "/outfits", label: "Outfits", Icon: SparkleIcon },
  { href: "/insights", label: "Insights", Icon: ChartIcon },
];

/**
 * Phone navigation. Moving sections down here buys back a row at the top of
 * every screen and puts them under the thumb, which is what the closet grid
 * needs most — clothes above the fold rather than controls.
 */
export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bone/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
    >
      <div className="flex">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                active ? "text-berry" : "text-muted"
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
