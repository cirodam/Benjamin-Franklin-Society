import { CommunityDb } from "../../CommunityDb.js";
import { FunctionalUnit } from "@ecf/core";

export class FunctionalUnitLoader {
    private get db() { return CommunityDb.getInstance().db; }

    save(unit: FunctionalUnit): void {
        const data = JSON.stringify({
            id: unit.id, type: unit.getType(), name: unit.name, description: unit.description,
            personIds: unit.personIds, roleIds: unit.roleIds,
            locationId: unit.locationId, createdAt: unit.createdAt.toISOString(),
        });
        this.db.prepare(
            "INSERT INTO functional_units (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data"
        ).run(unit.id, data);
    }

    loadAll(): FunctionalUnit[] {
        return (this.db.prepare("SELECT data FROM functional_units").all() as { data: string }[])
            .map(({ data }) => {
                const r = JSON.parse(data) as {
                    id: string; type: string; name: string; description: string;
                    personIds: string[]; roleIds: string[];
                    locationId: string | null; createdAt: string;
                };
                const unit = new FunctionalUnit(r.name, r.description, r.type, r.id);
                (unit as unknown as Record<string, unknown>)["createdAt"] = new Date(r.createdAt);
                unit.personIds  = r.personIds  ?? [];
                unit.roleIds    = r.roleIds    ?? [];
                unit.locationId = r.locationId ?? null;
                return unit;
            });
    }

    delete(id: string): boolean {
        return this.db.prepare("DELETE FROM functional_units WHERE id = ?").run(id).changes > 0;
    }
}

