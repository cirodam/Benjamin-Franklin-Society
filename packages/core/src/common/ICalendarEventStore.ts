import type { CalendarEvent } from "./CalendarEvent.js";

export interface ICalendarEventStore {
    save(event: CalendarEvent): void;
    loadAll(): CalendarEvent[];
    delete(id: string): boolean;
}
