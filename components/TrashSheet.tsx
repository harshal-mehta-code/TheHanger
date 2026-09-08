"use client";

import { useState } from "react";
import Modal from "./Modal";
import ItemPhoto from "./ItemPhoto";
import { TrashIcon } from "./Icons";
import { TRASH_DAYS } from "@/lib/db";
import { useCloset } from "@/lib/store";

function daysLeft(deletedAt: number) {
  const gone = Math.floor((Date.now() - deletedAt) / 86_400_000);
  return Math.max(0, TRASH_DAYS - gone);
}

export default function TrashSheet({ onClose }: { onClose: () => void }) {
  const { trash, restoreFromTrash, purgeTrashEntry } = useCloset();
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <Modal title="Recently deleted" onClose={onClose}>
      <div className="p-5">
        <p className="mb-4 text-sm leading-relaxed text-muted">
          Anything you delete waits here for {TRASH_DAYS} days before it goes for
          good. Restoring brings the piece back with its photo and history
          intact.
        </p>

        {trash.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
            Nothing deleted recently.
          </p>
        ) : (
          <ul className="space-y-2">
            {trash.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center gap-3 rounded-2xl border border-line p-2.5"
              >
                <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-bone-deep">
                  {entry.kind === "item" ? (
                    <ItemPhoto
                      imageId={entry.record.imageId}
                      alt=""
                      category={entry.record.category}
                      className="h-full w-full"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-lg">
                      ✨
                    </span>
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {entry.record.name}
                  </span>
                  <span className="block text-xs text-muted">
                    {entry.kind === "item" ? "Piece" : "Look"} ·{" "}
                    {daysLeft(entry.deletedAt)} days left
                  </span>
                </span>

                {confirming === entry.id ? (
                  <span className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      className="btn-ghost px-2.5 py-1.5 text-xs"
                    >
                      Keep
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await purgeTrashEntry(entry.id);
                        setConfirming(null);
                      }}
                      className="btn-primary bg-berry-deep px-2.5 py-1.5 text-xs hover:bg-berry"
                    >
                      Erase
                    </button>
                  </span>
                ) : (
                  <span className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void restoreFromTrash(entry.id)}
                      className="btn-ghost px-3 py-1.5 text-xs"
                    >
                      Restore
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(entry.id)}
                      aria-label={`Erase ${entry.record.name} permanently`}
                      className="rounded-full px-2 py-1.5 text-muted transition-colors hover:text-berry"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
