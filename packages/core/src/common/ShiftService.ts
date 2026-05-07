import { Shift } from "./Shift.js";
import type { IShiftStore } from "./IShiftStore.js";

export class ShiftService {
    private static instance: ShiftService;

    private shifts: Map<string, Shift> = new Map();
    private store: IShiftStore | null = null;

    private constructor() {}

    static getInstance(): ShiftService {
        if (!ShiftService.instance) ShiftService.instance = new ShiftService();
        return ShiftService.instance;
    }

    init(store: IShiftStore): void {
        this.store = store;
        for (const shift of store.loadAll()) {
            this.shifts.set(shift.id, shift);
        }
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    get(id: string): Shift | undefined {
        return this.shifts.get(id);
    }

    /** All shifts for a domain, sorted by start time. */
    getByDomain(domainId: string): Shift[] {
        return [...this.shifts.values()]
            .filter(s => s.domainId === domainId)
            .sort((a, b) => a.startAt.localeCompare(b.startAt));
    }

    /** All shifts assigned to a person, sorted by start time. */
    getByPerson(personId: string): Shift[] {
        return [...this.shifts.values()]
            .filter(s => s.assignedPersonId === personId)
            .sort((a, b) => a.startAt.localeCompare(b.startAt));
    }

    /** Unclaimed shifts, optionally filtered by domain. */
    getOpen(domainId?: string): Shift[] {
        return [...this.shifts.values()]
            .filter(s => s.isOpen && (domainId === undefined || s.domainId === domainId))
            .sort((a, b) => a.startAt.localeCompare(b.startAt));
    }

    /** Shifts whose startAt falls within [from, to] (inclusive ISO strings). */
    getRange(from: string, to: string, domainId?: string): Shift[] {
        return [...this.shifts.values()]
            .filter(s =>
                s.startAt >= from &&
                s.startAt <= to &&
                (domainId === undefined || s.domainId === domainId),
            )
            .sort((a, b) => a.startAt.localeCompare(b.startAt));
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    create(params: {
        domainId:  string;
        label:     string;
        startAt:   string;
        endAt:     string;
        createdBy: string;
        note?:     string | null;
    }): Shift {
        if (!params.label.trim())    throw new Error("label is required");
        if (!params.domainId.trim()) throw new Error("domainId is required");

        const start = new Date(params.startAt);
        const end   = new Date(params.endAt);
        if (isNaN(start.getTime())) throw new Error("startAt must be a valid ISO date");
        if (isNaN(end.getTime()))   throw new Error("endAt must be a valid ISO date");
        if (end <= start)           throw new Error("endAt must be after startAt");

        const shift = new Shift(
            params.domainId,
            params.label,
            params.startAt,
            params.endAt,
            params.createdBy,
            params.note ?? null,
        );
        this.shifts.set(shift.id, shift);
        this.store!.save(shift);
        return shift;
    }

    /** Assign a person to an open shift. Throws if already claimed. */
    claim(shiftId: string, personId: string): Shift {
        const shift = this.shifts.get(shiftId);
        if (!shift) throw new Error(`Shift ${shiftId} not found`);
        if (!shift.isOpen) throw new Error(`Shift ${shiftId} is already claimed`);
        shift.assignedPersonId = personId;
        this.store!.save(shift);
        return shift;
    }

    /** Remove the assigned person from a shift. */
    unclaim(shiftId: string): Shift {
        const shift = this.shifts.get(shiftId);
        if (!shift) throw new Error(`Shift ${shiftId} not found`);
        shift.assignedPersonId = null;
        this.store!.save(shift);
        return shift;
    }

    /** Reassign a shift from one person to another (or from open). */
    reassign(shiftId: string, personId: string): Shift {
        const shift = this.shifts.get(shiftId);
        if (!shift) throw new Error(`Shift ${shiftId} not found`);
        shift.assignedPersonId = personId;
        this.store!.save(shift);
        return shift;
    }

    delete(shiftId: string): void {
        const shift = this.shifts.get(shiftId);
        if (!shift) throw new Error(`Shift ${shiftId} not found`);
        this.shifts.delete(shiftId);
        this.store!.delete(shiftId);
    }
}
