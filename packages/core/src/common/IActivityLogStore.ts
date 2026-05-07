import type { ActivityLogEntry, ActivityLogType } from "./ActivityLog.js";

export interface IActivityLogStore {
    append(entry: ActivityLogEntry): void;
    load(limit?: number, before?: string): ActivityLogEntry[];
}

// Re-export for convenience so callers only need to import from one place
export type { ActivityLogType };
