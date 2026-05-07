import { CommunityDb } from "../CommunityDb.js";
import { Shift, type IShiftStore } from "@ecf/core";

interface ShiftRow {
    id: string; created_at: string; created_by: string;
    domain_id: string; label: string; start_at: string; end_at: string;
    assigned_person_id: string | null; note: string | null;
}

export class ShiftLoader implements IShiftStore {
    private get db() { return CommunityDb.getInstance().db; }

    save(shift: Shift): void {
        this.db.prepare(`
            INSERT INTO shifts
                (id, created_at, created_by, domain_id, label, start_at, end_at, assigned_person_id, note)
            VALUES
                (@id, @created_at, @created_by, @domain_id, @label, @start_at, @end_at, @assigned_person_id, @note)
            ON CONFLICT(id) DO UPDATE SET
                domain_id = excluded.domain_id, label = excluded.label,
                start_at = excluded.start_at, end_at = excluded.end_at,
                assigned_person_id = excluded.assigned_person_id, note = excluded.note
        `).run({
            id: shift.id, created_at: shift.createdAt, created_by: shift.createdBy,
            domain_id: shift.domainId, label: shift.label,
            start_at: shift.startAt, end_at: shift.endAt,
            assigned_person_id: shift.assignedPersonId ?? null,
            note: shift.note ?? null,
        });
    }

    loadAll(): Shift[] {
        return (this.db.prepare("SELECT * FROM shifts").all() as ShiftRow[])
            .map(r => Shift.restore({
                id: r.id, createdAt: r.created_at, createdBy: r.created_by,
                domainId: r.domain_id, label: r.label,
                startAt: r.start_at, endAt: r.end_at,
                assignedPersonId: r.assigned_person_id ?? null,
                note: r.note ?? null,
            }));
    }

    delete(id: string): boolean {
        return this.db.prepare("DELETE FROM shifts WHERE id = ?").run(id).changes > 0;
    }
}

