import { CommunityDb } from "../CommunityDb.js";
import { Location, type ILocationStore } from "@ecf/core";

interface LocationRow {
    id: string; name: string; address: string;
    lat: number | null; lng: number | null;
    description: string; created_at: string;
}

export class LocationLoader implements ILocationStore {
    private get db() { return CommunityDb.getInstance().db; }

    save(loc: Location): void {
        this.db.prepare(`
            INSERT INTO locations (id, name, address, lat, lng, description, created_at)
            VALUES (@id, @name, @address, @lat, @lng, @description, @created_at)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name, address = excluded.address,
                lat = excluded.lat, lng = excluded.lng,
                description = excluded.description
        `).run({
            id: loc.id, name: loc.name, address: loc.address,
            lat: loc.lat ?? null, lng: loc.lng ?? null,
            description: loc.description,
            created_at: loc.createdAt.toISOString(),
        });
    }

    loadAll(): Location[] {
        return (this.db.prepare("SELECT * FROM locations").all() as LocationRow[])
            .map(r => new Location(r.name, r.address, r.lat, r.lng, r.description, r.id, new Date(r.created_at)));
    }

    delete(id: string): boolean {
        return this.db.prepare("DELETE FROM locations WHERE id = ?").run(id).changes > 0;
    }
}

