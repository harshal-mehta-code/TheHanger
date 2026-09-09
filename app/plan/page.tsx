"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import DayPlanSheet from "@/components/DayPlanSheet";
import ItemPhoto from "@/components/ItemPhoto";
import TripSheet from "@/components/TripSheet";
import Modal from "@/components/Modal";
import { ChevronDownIcon, PlusIcon } from "@/components/Icons";
import { useCloset } from "@/lib/store";
import type { Item, Trip } from "@/lib/types";
import { outfitPieces, todayISO } from "@/lib/wardrobe";

type Tab = "calendar" | "packing";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Local "YYYY-MM-DD" for a Date, avoiding a UTC shift across midnight. */
function isoOf(d: Date) {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** The 6×7 grid covering a month, Monday first. */
function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  // getDay() is Sunday-first; shift so Monday is column 0.
  const lead = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - lead);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { date: d, iso: isoOf(d), inMonth: d.getMonth() === month };
  });
}

export default function PlanPage() {
  const {
    items,
    outfits,
    plans,
    trips,
    ready,
    setDayPlan,
    clearDayPlan,
    logOutfitWear,
    logWear,
    addTrip,
    updateTrip,
    deleteTrip,
    setPacked,
  } = useCloset();

  const [tab, setTab] = useState<Tab>("calendar");
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [openTripId, setOpenTripId] = useState<string | null>(null);
  const [newTripOpen, setNewTripOpen] = useState(false);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const flash = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const planByDate = useMemo(
    () => new Map(plans.map((p) => [p.date, p])),
    [plans],
  );
  const outfitById = useMemo(
    () => new Map(outfits.map((o) => [o.id, o])),
    [outfits],
  );
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const grid = useMemo(
    () => monthGrid(cursor.year, cursor.month),
    [cursor.year, cursor.month],
  );
  const today = todayISO();

  /** The pieces a plan resolves to, whether it came from a look or ad-hoc. */
  const piecesForDate = useCallback(
    (iso: string): Item[] => {
      const plan = planByDate.get(iso);
      if (!plan) return [];
      const outfit = plan.outfitId ? outfitById.get(plan.outfitId) : undefined;
      const fromOutfit = outfit ? outfitPieces(outfit, items) : [];
      const loose = plan.itemIds
        .map((id) => itemById.get(id))
        .filter((i): i is Item => Boolean(i));
      return [...fromOutfit, ...loose];
    },
    [planByDate, outfitById, itemById, items],
  );

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString(
    undefined,
    { month: "long", year: "numeric" },
  );

  const openTrip = openTripId
    ? trips.find((t) => t.id === openTripId) ?? null
    : null;
  const editingTrip = editingTripId
    ? trips.find((t) => t.id === editingTripId) ?? null
    : null;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-7xl px-4 pb-28 sm:px-6 sm:pb-16">
      <AppHeader
        addLabel="New list"
        onAdd={
          tab === "packing" ? () => setNewTripOpen(true) : undefined
        }
        subtitle="Plan ahead and pack"
        onNotify={flash}
      />

      <div className="mb-4 flex w-fit gap-1 rounded-full border border-line bg-shell p-1">
        {(
          [
            ["calendar", "Calendar"],
            ["packing", `Packing${trips.length ? ` · ${trips.length}` : ""}`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === id
                ? "bg-accent text-accent-ink"
                : "text-ink-soft hover:bg-berry-soft"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {!ready ? (
        <div className="card-surface h-96 animate-pulse" />
      ) : tab === "calendar" ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setCursor(({ year, month }) =>
                  month === 0
                    ? { year: year - 1, month: 11 }
                    : { year, month: month - 1 },
                )
              }
              aria-label="Previous month"
              className="btn-ghost px-3"
            >
              <ChevronDownIcon className="h-4 w-4 rotate-90" />
            </button>
            <h2 className="display text-lg font-semibold">{monthLabel}</h2>
            <button
              type="button"
              onClick={() =>
                setCursor(({ year, month }) =>
                  month === 11
                    ? { year: year + 1, month: 0 }
                    : { year, month: month + 1 },
                )
              }
              aria-label="Next month"
              className="btn-ghost px-3"
            >
              <ChevronDownIcon className="h-4 w-4 -rotate-90" />
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setCursor({ year: now.getFullYear(), month: now.getMonth() });
              }}
              className="btn-ghost ml-auto py-1.5 text-xs"
            >
              Today
            </button>
          </div>

          <div className="card-surface overflow-hidden p-2 sm:p-3">
            <div className="grid grid-cols-7 gap-1 pb-1">
              {WEEKDAYS.map((d) => (
                <div
                  key={d}
                  className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted"
                >
                  {/* One letter on the narrowest phones, three elsewhere —
                      done in CSS so it survives server rendering. */}
                  <span className="xs:hidden">{d.slice(0, 1)}</span>
                  <span className="hidden xs:inline">{d}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {grid.map(({ iso, date, inMonth }) => {
                const pieces = piecesForDate(iso);
                const isToday = iso === today;
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => setOpenDate(iso)}
                    className={`relative aspect-square overflow-hidden rounded-lg border text-left transition-colors sm:rounded-xl ${
                      isToday
                        ? "border-berry ring-1 ring-berry"
                        : "border-line hover:border-ink"
                    } ${inMonth ? "" : "opacity-40"}`}
                  >
                    {pieces.length > 0 ? (
                      <span className="absolute inset-0 grid grid-cols-2 gap-px">
                        {pieces.slice(0, 4).map((piece) => (
                          <ItemPhoto
                            key={piece.id}
                            imageId={piece.imageId}
                            alt=""
                            category={piece.category}
                            className="h-full w-full"
                          />
                        ))}
                      </span>
                    ) : null}
                    <span
                      className={`absolute left-1 top-1 rounded px-1 text-[10px] font-semibold tabular-nums sm:text-xs ${
                        pieces.length > 0
                          ? "bg-shell/90 text-ink backdrop-blur-sm"
                          : isToday
                            ? "text-berry"
                            : "text-ink-soft"
                      }`}
                    >
                      {date.getDate()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-muted">
            Tap a day to plan what to wear. Saved looks show up as a thumbnail,
            so the week reads at a glance.
          </p>
        </div>
      ) : trips.length === 0 ? (
        <div className="animate-rise card-surface mx-auto mt-6 max-w-xl px-6 py-14 text-center">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-berry-soft text-3xl">
            🧳
          </span>
          <h2 className="display mt-6 text-2xl font-semibold">
            Pack without the pile
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
            Build a list from looks and pieces you already own, then tick each
            one off as it goes in the case. Add a whole look and every piece in
            it joins the list.
          </p>
          <button
            type="button"
            onClick={() => setNewTripOpen(true)}
            className="btn-primary mx-auto mt-6"
          >
            <PlusIcon className="h-4 w-4" />
            Start a packing list
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {trips
            .slice()
            .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""))
            .map((trip) => {
              const total = new Set([
                ...trip.outfitIds.flatMap((id) => {
                  const o = outfitById.get(id);
                  return o ? outfitPieces(o, items).map((p) => p.id) : [];
                }),
                ...trip.itemIds.filter((id) => itemById.has(id)),
              ]);
              const packed = [...total].filter((id) =>
                trip.packed.includes(id),
              ).length;
              return (
                <button
                  key={trip.id}
                  type="button"
                  onClick={() => setOpenTripId(trip.id)}
                  className="card-surface animate-rise p-4 text-left transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
                >
                  <p className="truncate text-sm font-semibold">{trip.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {trip.destination || "Packing list"}
                  </p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-bone-deep">
                    <div
                      className="h-full rounded-full bg-sage-bright transition-all"
                      style={{
                        width: `${total.size ? (packed / total.size) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted">
                    {packed} of {total.size} packed
                  </p>
                </button>
              );
            })}
        </div>
      )}

      {openDate && (
        <DayPlanSheet
          date={openDate}
          plan={planByDate.get(openDate) ?? null}
          items={items}
          outfits={outfits}
          onClose={() => setOpenDate(null)}
          onSave={async (plan) => {
            await setDayPlan(openDate, plan);
            flash("Plan saved.");
          }}
          onClear={async () => {
            await clearDayPlan(openDate);
            flash("Day cleared.");
          }}
          onWear={async () => {
            const plan = planByDate.get(openDate);
            if (!plan) return;
            if (plan.outfitId) await logOutfitWear(plan.outfitId, openDate);
            for (const id of plan.itemIds) await logWear(id, openDate);
            flash("Logged as worn.");
          }}
        />
      )}

      {openTrip && (
        <TripSheet
          onEditDetails={() => setEditingTripId(openTrip.id)}
          trip={openTrip}
          items={items}
          outfits={outfits}
          onClose={() => setOpenTripId(null)}
          onUpdate={(draft) => updateTrip(openTrip.id, draft)}
          onDelete={async () => {
            const name = openTrip.name;
            setOpenTripId(null);
            await deleteTrip(openTrip.id);
            flash(`Removed “${name}”.`);
          }}
          onSetPacked={(itemId, packed) =>
            setPacked(openTrip.id, itemId, packed)
          }
        />
      )}

      {editingTrip && (
        <TripDetailsSheet
          trip={editingTrip}
          onClose={() => setEditingTripId(null)}
          onCreate={async (draft) => {
            await updateTrip(editingTrip.id, draft);
            setEditingTripId(null);
          }}
        />
      )}

      {newTripOpen && (
        <TripDetailsSheet
          onClose={() => setNewTripOpen(false)}
          onCreate={async (draft) => {
            const trip = await addTrip(draft);
            setNewTripOpen(false);
            setOpenTripId(trip.id);
            flash(`“${trip.name}” started.`);
          }}
        />
      )}

      <BottomNav />

      {toast && (
        <div
          role="status"
          className="animate-rise fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-bone shadow-[var(--shadow-lift)] sm:bottom-6"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

/**
 * Creates a list, and edits one. The details were previously write-once, so a
 * typo in a trip name outlived the trip.
 */
function TripDetailsSheet({
  trip,
  onClose,
  onCreate,
}: {
  trip?: Trip;
  onClose: () => void;
  onCreate: (draft: Omit<Trip, "id" | "createdAt" | "updatedAt" | "packed">) => Promise<void>;
}) {
  const [name, setName] = useState(trip?.name ?? "");
  const [destination, setDestination] = useState(trip?.destination ?? "");
  const [startDate, setStartDate] = useState(trip?.startDate ?? "");
  const [endDate, setEndDate] = useState(trip?.endDate ?? "");
  const [notes, setNotes] = useState(trip?.notes ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Modal
      title={trip ? "Trip details" : "New packing list"}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button
            type="submit"
            form="new-trip"
            disabled={busy}
            className="btn-primary disabled:opacity-55"
          >
            {busy
              ? trip
                ? "Saving…"
                : "Creating…"
              : trip
                ? "Save"
                : "Create"}
          </button>
        </div>
      }
    >
      <form
        id="new-trip"
        className="space-y-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) {
            setProblem("Give the list a name.");
            return;
          }
          setBusy(true);
          try {
            await onCreate({
              name: name.trim(),
              destination: destination.trim() || undefined,
              startDate: startDate || undefined,
              endDate: endDate || undefined,
              notes: notes.trim() || undefined,
              // Editing details must not disturb what has been packed.
              outfitIds: trip?.outfitIds ?? [],
              itemIds: trip?.itemIds ?? [],
            });
          } catch {
            setBusy(false);
            setProblem("Couldn't save that. Try again.");
          }
        }}
      >
        <div>
          <label className="label" htmlFor="trip-name">
            Name
          </label>
          <input
            id="trip-name"
            autoFocus={!trip}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Amalfi, June"
            className="field"
            maxLength={60}
          />
        </div>
        <div>
          <label className="label" htmlFor="trip-dest">
            Destination
          </label>
          <input
            id="trip-dest"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Positano"
            className="field"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="trip-start">
              From
            </label>
            <input
              id="trip-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="field"
            />
          </div>
          <div>
            <label className="label" htmlFor="trip-end">
              To
            </label>
            <input
              id="trip-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="field"
            />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="trip-notes">
            Notes
          </label>
          <textarea
            id="trip-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Carry-on only. One nice dinner."
            className="field resize-y"
          />
        </div>
        {problem && (
          <p role="alert" className="text-sm font-medium text-berry">
            {problem}
          </p>
        )}
      </form>
    </Modal>
  );
}
