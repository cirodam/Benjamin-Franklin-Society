import { CommunityDb } from "../CommunityDb.js";
import { Motion, type MotionData } from "@ecf/core";

export class MotionLoader {
    private get db() { return CommunityDb.getInstance().db; }

    save(m: Motion): void {
        const data = JSON.stringify(m.toData());
        this.db.prepare(
            "INSERT INTO motions (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data"
        ).run(m.id, data);
    }

    loadAll(): Motion[] {
        return (this.db.prepare("SELECT data FROM motions").all() as { data: string }[])
            .map(({ data }) => Motion.fromData(JSON.parse(data) as MotionData));
    }

    delete(id: string): boolean {
        return this.db.prepare("DELETE FROM motions WHERE id = ?").run(id).changes > 0;
    }
}

