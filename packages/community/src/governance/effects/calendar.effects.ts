import { effectRegistry } from "@ecf/core";
import { CalendarService } from "../../calendar/CalendarService.js";

// ── schedule-community-event ──────────────────────────────────────────────────
// Payload: {
//   title, startAt, endAt?, allDay?, description?, location?,
//   recurrence?, recurrenceEndsAt?
// }

const VALID_RECURRENCE = new Set(["daily", "weekly", "biweekly", "monthly", "yearly"]);

effectRegistry.register("schedule-community-event", {
    label:       "Schedule community event",
    authorityId: "assembly",
    validate(raw) {
        if (typeof raw !== "object" || raw === null) return "Payload must be an object";
        const p = raw as Record<string, unknown>;

        if (typeof p.title !== "string" || !p.title.trim())
            return "payload.title must be a non-empty string";

        if (typeof p.startAt !== "string" || isNaN(new Date(p.startAt).getTime()))
            return "payload.startAt must be a valid ISO 8601 date string";

        if (p.endAt !== undefined && p.endAt !== null) {
            if (typeof p.endAt !== "string" || isNaN(new Date(p.endAt).getTime()))
                return "payload.endAt must be a valid ISO 8601 date string";
            if (new Date(p.endAt) <= new Date(p.startAt as string))
                return "payload.endAt must be after startAt";
        }

        if (p.recurrence !== undefined && p.recurrence !== null) {
            if (typeof p.recurrence !== "string" || !VALID_RECURRENCE.has(p.recurrence))
                return "payload.recurrence must be daily|weekly|biweekly|monthly|yearly";
        }

        if (p.recurrenceEndsAt !== undefined && p.recurrenceEndsAt !== null) {
            if (typeof p.recurrenceEndsAt !== "string" || isNaN(new Date(p.recurrenceEndsAt).getTime()))
                return "payload.recurrenceEndsAt must be a valid ISO 8601 date string";
        }

        return null;
    },
    handler({ motion, payload }) {
        const svc         = CalendarService.getInstance();
        const organizerId = motion.proposerId;

        const event = svc.create({
            title:            (payload.title as string).trim(),
            startAt:          payload.startAt as string,
            createdBy:        organizerId,
            organizerId,
            organizerType:    "person",
            endAt:            (payload.endAt            as string  | null | undefined) ?? null,
            allDay:           (payload.allDay           as boolean | undefined)        ?? false,
            description:      (payload.description      as string  | null | undefined) ?? null,
            location:         (payload.location         as string  | null | undefined) ?? null,
            recurrence:       (payload.recurrence       as "daily" | "weekly" | "biweekly" | "monthly" | "yearly" | null | undefined) ?? null,
            recurrenceEndsAt: (payload.recurrenceEndsAt as string  | null | undefined) ?? null,
        });

        const recLabel = event.recurrence ? ` (repeats ${event.recurrence})` : "";
        motion.outcomeNote = `Community event scheduled: "${event.title}"${recLabel} starting ${event.startAt.slice(0, 10)} (id: ${event.id}).`;
    },
});
