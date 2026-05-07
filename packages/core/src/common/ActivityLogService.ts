import { makeLogEntry, type ActivityLogEntry, type ActivityLogType } from "./ActivityLog.js";
import type { IActivityLogStore } from "./IActivityLogStore.js";

export class ActivityLogService {
    private static instance: ActivityLogService;
    private store!: IActivityLogStore;

    private constructor() {}

    static getInstance(): ActivityLogService {
        if (!ActivityLogService.instance) ActivityLogService.instance = new ActivityLogService();
        return ActivityLogService.instance;
    }

    init(store: IActivityLogStore): void {
        this.store = store;
    }

    write(
        type:    ActivityLogType,
        summary: string,
        opts:    { actorId?: string | null; refId?: string | null; occurredAt?: string } = {},
    ): void {
        const entry = makeLogEntry(type, summary, opts);
        this.store.append(entry);
    }

    recent(limit = 50, before?: string): ActivityLogEntry[] {
        return this.store.load(limit, before);
    }
}
