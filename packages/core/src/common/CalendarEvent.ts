import { randomUUID } from "crypto";

export type RecurrenceRule = "daily" | "weekly" | "biweekly" | "monthly" | "yearly";

export interface Rsvp {
    personId:    string;
    status:      "yes" | "no" | "maybe";
    respondedAt: string;
}

export class CalendarEvent {

    readonly id:          string;
    readonly createdAt:   string;
    readonly createdBy:   string;    // personId

    title:       string;
    description: string | null;
    location:    string | null;
    startAt:     string;             // ISO 8601
    endAt:       string | null;      // ISO 8601; null = all-day or open-ended
    allDay:      boolean;
    cancelledAt: string | null;

    /** personId or orgId that is hosting/organising the event. */
    organizerId:   string;
    organizerType: "person" | "org";

    recurrence:       RecurrenceRule | null;
    recurrenceEndsAt: string | null;

    rsvps: Rsvp[];

    constructor(
        title:         string,
        startAt:       string,
        createdBy:     string,
        organizerId:   string,
        organizerType: "person" | "org",
        endAt:              string | null    = null,
        allDay:             boolean          = false,
        description:        string | null    = null,
        location:           string | null    = null,
        recurrence:         RecurrenceRule | null = null,
        recurrenceEndsAt:   string | null    = null,
    ) {
        this.id            = randomUUID();
        this.createdAt     = new Date().toISOString();
        this.createdBy     = createdBy;
        this.title         = title.trim();
        this.description   = description;
        this.location      = location;
        this.startAt       = startAt;
        this.endAt         = endAt;
        this.allDay        = allDay;
        this.cancelledAt      = null;
        this.organizerId      = organizerId;
        this.organizerType    = organizerType;
        this.recurrence       = recurrence;
        this.recurrenceEndsAt = recurrenceEndsAt;
        this.rsvps            = [];
    }

    get isCancelled(): boolean { return this.cancelledAt !== null; }

    rsvp(personId: string, status: "yes" | "no" | "maybe"): void {
        const existing = this.rsvps.findIndex(r => r.personId === personId);
        const entry: Rsvp = { personId, status, respondedAt: new Date().toISOString() };
        if (existing >= 0) {
            this.rsvps[existing] = entry;
        } else {
            this.rsvps.push(entry);
        }
    }

    removeRsvp(personId: string): void {
        this.rsvps = this.rsvps.filter(r => r.personId !== personId);
    }

    static restore(r: {
        id:            string;
        createdAt:     string;
        createdBy:        string;
        title:            string;
        description:      string | null;
        location:         string | null;
        startAt:          string;
        endAt:            string | null;
        allDay:           boolean;
        cancelledAt:      string | null;
        organizerId:      string;
        organizerType:    "person" | "org";
        recurrence?:      RecurrenceRule | null;
        recurrenceEndsAt?: string | null;
        rsvps:            Rsvp[];
    }): CalendarEvent {
        const e = new CalendarEvent(
            r.title,
            r.startAt,
            r.createdBy,
            r.organizerId,
            r.organizerType,
            r.endAt,
            r.allDay,
            r.description,
            r.location,
        );
        (e as unknown as Record<string, unknown>)["id"]        = r.id;
        (e as unknown as Record<string, unknown>)["createdAt"] = r.createdAt;
        e.cancelledAt      = r.cancelledAt;
        e.recurrence       = r.recurrence      ?? null;
        e.recurrenceEndsAt = r.recurrenceEndsAt ?? null;
        e.rsvps            = r.rsvps ?? [];
        return e;
    }
}
