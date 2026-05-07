import { CommunityDb } from "../CommunityDb.js";
import { CalendarEvent, type ICalendarEventStore } from "@ecf/core";

export class CalendarEventLoader implements ICalendarEventStore {
    private get db() { return CommunityDb.getInstance().db; }

    save(event: CalendarEvent): void {
        const data = JSON.stringify({
            id: event.id, createdAt: event.createdAt, createdBy: event.createdBy,
            title: event.title, description: event.description,
            location: event.location, startAt: event.startAt, endAt: event.endAt,
            allDay: event.allDay, cancelledAt: event.cancelledAt,
            organizerId: event.organizerId, organizerType: event.organizerType,
            recurrence: event.recurrence, recurrenceEndsAt: event.recurrenceEndsAt,
            rsvps: event.rsvps,
        });
        this.db.prepare(
            "INSERT INTO calendar_events (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data"
        ).run(event.id, data);
    }

    loadAll(): CalendarEvent[] {
        return (this.db.prepare("SELECT data FROM calendar_events").all() as { data: string }[])
            .map(({ data }) => CalendarEvent.restore(JSON.parse(data)));
    }

    delete(id: string): boolean {
        return this.db.prepare("DELETE FROM calendar_events WHERE id = ?").run(id).changes > 0;
    }
}

