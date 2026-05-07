import { CommunityDb } from "../CommunityDb.js";
import { type ActivityLogEntry, type ActivityLogType, type IActivityLogStore } from "@ecf/core";

export class ActivityLogLoader implements IActivityLogStore {
    private get db() { return CommunityDb.getInstance().db; }

    append(entry: ActivityLogEntry): void {
        this.db.prepare(`
            INSERT INTO community_log (id, type, summary, actor_id, ref_id, occurred_at)
            VALUES (@id, @type, @summary, @actor_id, @ref_id, @occurred_at)
        `).run({
            id:          entry.id,
            type:        entry.type,
            summary:     entry.summary,
            actor_id:    entry.actorId,
            ref_id:      entry.refId,
            occurred_at: entry.occurredAt,
        });
    }

    /**
     * Load entries in reverse-chronological order.
     * @param limit  Max entries to return (default 50)
     * @param before ISO timestamp cursor — only entries before this point
     */
    load(limit = 50, before?: string): ActivityLogEntry[] {
        if (before) {
            return (this.db.prepare(`
                SELECT id, type, summary, actor_id, ref_id, occurred_at
                FROM community_log
                WHERE occurred_at < ?
                ORDER BY occurred_at DESC
                LIMIT ?
            `).all(before, limit) as RawRow[]).map(toEntry);
        }
        return (this.db.prepare(`
            SELECT id, type, summary, actor_id, ref_id, occurred_at
            FROM community_log
            ORDER BY occurred_at DESC
            LIMIT ?
        `).all(limit) as RawRow[]).map(toEntry);
    }
}

interface RawRow {
    id:          string;
    type:        ActivityLogType;
    summary:     string;
    actor_id:    string | null;
    ref_id:      string | null;
    occurred_at: string;
}

function toEntry(r: RawRow): ActivityLogEntry {
    return {
        id:         r.id,
        type:       r.type,
        summary:    r.summary,
        actorId:    r.actor_id,
        refId:      r.ref_id,
        occurredAt: r.occurred_at,
    };
}
