import { CalendarEvent, type RecurrenceRule } from "./CalendarEvent.js";
import type { ICalendarEventStore } from "./ICalendarEventStore.js";

export interface CalendarOccurrence {
    event:          CalendarEvent;
    startAt:        string;
    endAt:          string | null;
    occurrenceDate: string | null; // YYYY-MM-DD; null for non-recurring
}

export class CalendarService {
    private static instance: CalendarService;

    private events: Map<string, CalendarEvent> = new Map();
    private store: ICalendarEventStore | null   = null;

    private constructor() {}

    static getInstance(): CalendarService {
        if (!CalendarService.instance) CalendarService.instance = new CalendarService();
        return CalendarService.instance;
    }

    init(store: ICalendarEventStore): void {
        this.store = store;
        for (const event of store.loadAll()) {
            this.events.set(event.id, event);
        }
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    getAll(): CalendarEvent[] {
        return [...this.events.values()].sort((a, b) => a.startAt.localeCompare(b.startAt));
    }

    get(id: string): CalendarEvent | undefined {
        return this.events.get(id);
    }

    /**
     * Upcoming events (start >= now), optionally limited by count.
     * Recurring events are expanded — the next occurrence is included.
     */
    upcoming(limit?: number): CalendarOccurrence[] {
        const now = new Date();
        const far = new Date(now);
        far.setFullYear(far.getFullYear() + 2); // expand up to 2 years out
        const nowIso = now.toISOString();
        const farIso = far.toISOString();

        const results: CalendarOccurrence[] = [];
        for (const event of this.events.values()) {
            if (event.isCancelled) continue;
            if (event.recurrence) {
                const occ = this.expandOccurrences(event, nowIso, farIso);
                if (occ.length) results.push(occ[0]!);
            } else {
                if (event.startAt >= nowIso) {
                    results.push({ event, startAt: event.startAt, endAt: event.endAt, occurrenceDate: null });
                }
            }
        }
        results.sort((a, b) => a.startAt.localeCompare(b.startAt));
        return limit ? results.slice(0, limit) : results;
    }

    /**
     * All occurrences within [from, to] (ISO strings, inclusive on start).
     * Recurring events are expanded into individual occurrences.
     */
    inRange(from: string, to: string): CalendarOccurrence[] {
        const results: CalendarOccurrence[] = [];
        for (const event of this.events.values()) {
            results.push(...this.expandOccurrences(event, from, to));
        }
        results.sort((a, b) => a.startAt.localeCompare(b.startAt));
        return results;
    }

    /** All events organised by a person or org. */
    byOrganizer(organizerId: string): CalendarEvent[] {
        return [...this.events.values()]
            .filter(e => e.organizerId === organizerId)
            .sort((a, b) => a.startAt.localeCompare(b.startAt));
    }

    // ── Occurrence expansion ──────────────────────────────────────────────────

    private advanceDate(d: Date, rule: RecurrenceRule): void {
        switch (rule) {
            case "daily":    d.setDate(d.getDate() + 1);           break;
            case "weekly":   d.setDate(d.getDate() + 7);           break;
            case "biweekly": d.setDate(d.getDate() + 14);          break;
            case "monthly":  d.setMonth(d.getMonth() + 1);         break;
            case "yearly":   d.setFullYear(d.getFullYear() + 1);   break;
        }
    }

    private expandOccurrences(event: CalendarEvent, from: string, to: string): CalendarOccurrence[] {
        const fromMs = new Date(from).getTime();
        const toMs   = new Date(to).getTime();

        if (!event.recurrence) {
            const startMs = new Date(event.startAt).getTime();
            if (startMs >= fromMs && startMs <= toMs) {
                return [{ event, startAt: event.startAt, endAt: event.endAt, occurrenceDate: null }];
            }
            return [];
        }

        const rule     = event.recurrence;
        const origin   = new Date(event.startAt);
        const duration = event.endAt ? (new Date(event.endAt).getTime() - origin.getTime()) : null;
        const endsAtMs = event.recurrenceEndsAt ? new Date(event.recurrenceEndsAt).getTime() : Infinity;

        const results: CalendarOccurrence[] = [];
        const cur = new Date(origin);
        const MAX = 3650;
        let iters = 0;

        // Fast-forward to first occurrence on/after `from`
        while (cur.getTime() < fromMs && iters < MAX) {
            this.advanceDate(cur, rule);
            iters++;
        }

        // Collect occurrences up to `to`
        while (cur.getTime() <= toMs && iters < MAX) {
            iters++;
            if (cur.getTime() > endsAtMs) break;
            const occStart = cur.toISOString();
            const occEnd   = duration !== null ? new Date(cur.getTime() + duration).toISOString() : null;
            results.push({
                event,
                startAt:        occStart,
                endAt:          occEnd,
                occurrenceDate: cur.toISOString().slice(0, 10),
            });
            this.advanceDate(cur, rule);
        }

        return results;
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    create(params: {
        title:              string;
        startAt:            string;
        createdBy:          string;
        organizerId:        string;
        organizerType:      "person" | "org";
        endAt?:             string | null;
        allDay?:            boolean;
        description?:       string | null;
        location?:          string | null;
        recurrence?:        RecurrenceRule | null;
        recurrenceEndsAt?:  string | null;
    }): CalendarEvent {
        if (!params.title.trim()) throw new Error("title is required");

        const start = new Date(params.startAt);
        if (isNaN(start.getTime())) throw new Error("startAt must be a valid ISO date");

        if (params.endAt) {
            const end = new Date(params.endAt);
            if (isNaN(end.getTime()))   throw new Error("endAt must be a valid ISO date");
            if (end < start)            throw new Error("endAt must be after startAt");
        }

        const event = new CalendarEvent(
            params.title,
            params.startAt,
            params.createdBy,
            params.organizerId,
            params.organizerType,
            params.endAt            ?? null,
            params.allDay           ?? false,
            params.description      ?? null,
            params.location         ?? null,
            params.recurrence       ?? null,
            params.recurrenceEndsAt ?? null,
        );
        this.events.set(event.id, event);
        this.store!.save(event);
        return event;
    }

    update(id: string, patch: {
        title?:            string;
        description?:      string | null;
        location?:         string | null;
        startAt?:          string;
        endAt?:            string | null;
        allDay?:           boolean;
        recurrence?:       RecurrenceRule | null;
        recurrenceEndsAt?: string | null;
    }): CalendarEvent {
        const event = this.events.get(id);
        if (!event)           throw new Error("Event not found");
        if (event.isCancelled) throw new Error("Cannot update a cancelled event");

        if (patch.title            !== undefined) event.title            = patch.title.trim();
        if (patch.description      !== undefined) event.description      = patch.description;
        if (patch.location         !== undefined) event.location         = patch.location;
        if (patch.allDay           !== undefined) event.allDay           = patch.allDay;
        if (patch.recurrence       !== undefined) event.recurrence       = patch.recurrence;
        if (patch.recurrenceEndsAt !== undefined) event.recurrenceEndsAt = patch.recurrenceEndsAt;

        if (patch.startAt !== undefined) {
            if (isNaN(new Date(patch.startAt).getTime())) throw new Error("startAt must be a valid ISO date");
            event.startAt = patch.startAt;
        }
        if (patch.endAt !== undefined) {
            if (patch.endAt && isNaN(new Date(patch.endAt).getTime())) throw new Error("endAt must be a valid ISO date");
            event.endAt = patch.endAt;
        }

        this.store!.save(event);
        return event;
    }

    cancel(id: string): CalendarEvent {
        const event = this.events.get(id);
        if (!event)           throw new Error("Event not found");
        if (event.isCancelled) throw new Error("Event is already cancelled");
        (event as unknown as Record<string, unknown>)["cancelledAt"] = new Date().toISOString();
        this.store!.save(event);
        return event;
    }

    rsvp(id: string, personId: string, status: "yes" | "no" | "maybe"): CalendarEvent {
        const event = this.events.get(id);
        if (!event)           throw new Error("Event not found");
        if (event.isCancelled) throw new Error("Cannot RSVP to a cancelled event");
        event.rsvp(personId, status);
        this.store!.save(event);
        return event;
    }

    removeRsvp(id: string, personId: string): CalendarEvent {
        const event = this.events.get(id);
        if (!event) throw new Error("Event not found");
        event.removeRsvp(personId);
        this.store!.save(event);
        return event;
    }
}
