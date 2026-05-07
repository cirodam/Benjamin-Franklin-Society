import { Request, Response } from "express";
import { CalendarService, type CalendarOccurrence, CalendarEvent } from "@ecf/core";
import { PersonService } from "../person/PersonService.js";

type AuthedRequest = Request & { personId?: string };

const svc = () => CalendarService.getInstance();

function toDto(event: CalendarEvent, occ?: Pick<CalendarOccurrence, "startAt" | "endAt" | "occurrenceDate">) {
    const ppl = PersonService.getInstance();
    const resolveHandle = (id: string) => ppl.get(id)?.handle ?? null;
    return {
        id:               event.id,
        title:            event.title,
        description:      event.description,
        location:         event.location,
        startAt:          occ?.startAt        ?? event.startAt,
        endAt:            occ?.endAt          ?? event.endAt,
        allDay:           event.allDay,
        cancelledAt:      event.cancelledAt,
        organizerId:      event.organizerType === "person" ? resolveHandle(event.organizerId) : event.organizerId,
        organizerType:    event.organizerType,
        createdByHandle:  resolveHandle(event.createdBy),
        createdAt:        event.createdAt,
        rsvps:            event.rsvps.map(r => ({ handle: resolveHandle(r.personId), status: r.status, respondedAt: r.respondedAt })),
        recurrence:       event.recurrence,
        recurrenceEndsAt: event.recurrenceEndsAt,
        occurrenceDate:   occ?.occurrenceDate ?? null,
    };
}

function occurrenceToDto(occ: CalendarOccurrence) {
    return toDto(occ.event, occ);
}

// GET /api/calendar
// Query params: from, to (ISO strings), upcoming=<n>
export function listEvents(req: Request, res: Response): void {
    const { from, to, upcoming } = req.query as Record<string, string | undefined>;
    if (upcoming) {
        const limit = parseInt(upcoming, 10);
        res.json(svc().upcoming(isNaN(limit) ? undefined : limit).map(occurrenceToDto));
        return;
    }
    if (from && to) {
        res.json(svc().inRange(from, to).map(occurrenceToDto));
        return;
    }
    res.json(svc().getAll().map(e => toDto(e)));
}

// GET /api/calendar/:id
export function getEvent(req: Request, res: Response): void {
    const event = svc().get(req.params.id as string);
    if (!event) { res.status(404).json({ error: "Event not found" }); return; }
    res.json(toDto(event));
}

// POST /api/calendar
// Body: { title, startAt, organizerHandle?, organizerId?, organizerType, endAt?, allDay?, description?, location?, recurrence?, recurrenceEndsAt? }
export function createEvent(req: AuthedRequest, res: Response): void {
    const { title, startAt, organizerHandle, organizerType, endAt, allDay, description, location, recurrence, recurrenceEndsAt } = req.body ?? {};
    if (typeof title !== "string" || !title.trim()) {
        res.status(400).json({ error: "title is required" }); return;
    }
    if (typeof startAt !== "string" || !startAt) {
        res.status(400).json({ error: "startAt is required" }); return;
    }
    if (organizerType !== "person" && organizerType !== "org") {
        res.status(400).json({ error: "organizerType must be 'person' or 'org'" }); return;
    }
    const validRecurrence = ["daily", "weekly", "biweekly", "monthly", "yearly", null, undefined];
    if (!validRecurrence.includes(recurrence)) {
        res.status(400).json({ error: "recurrence must be daily|weekly|biweekly|monthly|yearly or null" }); return;
    }

    // Resolve organizer: for person type, look up by handle
    let organizerId: string;
    if (organizerType === "person") {
        if (typeof organizerHandle !== "string" || !organizerHandle) {
            res.status(400).json({ error: "organizerHandle is required when organizerType is 'person'" }); return;
        }
        const organizer = PersonService.getInstance().getByHandle(organizerHandle);
        if (!organizer) { res.status(422).json({ error: "Organizer not found" }); return; }
        organizerId = organizer.id;
    } else {
        // org type: use organizerId directly
        const orgId = req.body?.organizerId;
        if (typeof orgId !== "string" || !orgId) {
            res.status(400).json({ error: "organizerId is required when organizerType is 'org'" }); return;
        }
        organizerId = orgId;
    }

    // createdBy comes from the authenticated person credential
    const createdBy: string = req.personId ?? organizerId;

    try {
        const event = svc().create({ title, startAt, createdBy, organizerId, organizerType, endAt, allDay, description, location, recurrence: recurrence ?? null, recurrenceEndsAt: recurrenceEndsAt ?? null });
        res.status(201).json(toDto(event));
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}

// PATCH /api/calendar/:id
export function updateEvent(req: Request, res: Response): void {
    try {
        const event = svc().update(req.params.id as string, req.body ?? {});
        res.json(toDto(event));
    } catch (err) {
        res.status(404).json({ error: (err as Error).message });
    }
}

// DELETE /api/calendar/:id  (cancel)
export function cancelEvent(req: Request, res: Response): void {
    try {
        const event = svc().cancel(req.params.id as string);
        res.json(toDto(event));
    } catch (err) {
        res.status(404).json({ error: (err as Error).message });
    }
}

// POST /api/calendar/:id/rsvp
// Body: { status: "yes"|"no"|"maybe" } — person is taken from auth token
export function rsvpToEvent(req: AuthedRequest, res: Response): void {
    const personId = req.personId;
    if (!personId) { res.status(401).json({ error: "Authentication required" }); return; }
    const { status } = req.body ?? {};
    if (status !== "yes" && status !== "no" && status !== "maybe") {
        res.status(400).json({ error: "status must be 'yes', 'no', or 'maybe'" }); return;
    }
    try {
        const event = svc().rsvp(req.params.id as string, personId, status);
        res.json(toDto(event));
    } catch (err) {
        res.status(404).json({ error: (err as Error).message });
    }
}

// DELETE /api/calendar/:id/rsvp/:handle
export function removeRsvp(req: Request, res: Response): void {
    try {
        const person = PersonService.getInstance().getByHandle(req.params.handle as string);
        if (!person) { res.status(404).json({ error: "Person not found" }); return; }
        const event = svc().removeRsvp(req.params.id as string, person.id);
        res.json(toDto(event));
    } catch (err) {
        res.status(404).json({ error: (err as Error).message });
    }
}
