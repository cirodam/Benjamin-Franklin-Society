import { CommunityDb } from "../../CommunityDb.js";
import { FunctionalRole } from "@ecf/core";
import type { ScheduleSlot } from "@ecf/core";

export class FunctionalRoleLoader {
    private get db() { return CommunityDb.getInstance().db; }

    save(role: FunctionalRole): void {
        const data = JSON.stringify({
            id: role.id, title: role.title, description: role.description,
            roleTypeId: role.roleTypeId, memberId: role.memberId,
            kinPerMonth: role.kinPerMonth, funded: role.funded,
            termStartDate: role.termStartDate?.toISOString() ?? null,
            termEndDate:   role.termEndDate?.toISOString()   ?? null,
            weeklySchedule: role.weeklySchedule,
        });
        this.db.prepare(
            "INSERT INTO community_roles (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data"
        ).run(role.id, data);
    }

    loadAll(): FunctionalRole[] {
        return (this.db.prepare("SELECT data FROM community_roles").all() as { data: string }[])
            .map(({ data }) => {
                const r = JSON.parse(data) as {
                    id: string; title: string; description: string;
                    roleTypeId: string | null; memberId: string | null;
                    kinPerMonth: number; funded: boolean;
                    termStartDate: string | null; termEndDate: string | null;
                    weeklySchedule: ScheduleSlot[];
                };
                const role = new FunctionalRole(r.title, r.description, r.kinPerMonth, r.roleTypeId ?? null);
                (role as unknown as Record<string, unknown>)["id"] = r.id;
                role.memberId       = r.memberId;
                role.funded         = r.funded;
                role.termStartDate  = r.termStartDate ? new Date(r.termStartDate) : null;
                role.termEndDate    = r.termEndDate   ? new Date(r.termEndDate)   : null;
                role.weeklySchedule = r.weeklySchedule ?? [];
                return role;
            });
    }

    delete(id: string): boolean {
        return this.db.prepare("DELETE FROM community_roles WHERE id = ?").run(id).changes > 0;
    }
}

