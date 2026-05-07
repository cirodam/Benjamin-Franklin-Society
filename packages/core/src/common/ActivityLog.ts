import { randomUUID } from "crypto";

export type ActivityLogType =
    | "motion-passed"
    | "motion-failed"
    | "motion-withdrawn"
    | "member-joined"
    | "member-discharged"
    | "demurrage-run"
    | "dues-collected"
    | "constitution-amended"
    | "annual-issuance"
    | "pool-created"
    | "assembly-drawn"
    | "bylaw-created"
    | "bylaw-amended"
    | "bylaw-expired"
    | "role-type-added"
    | "role-type-removed"
    | "unit-type-added"
    | "unit-type-removed"
    | "unit-deployed"
    | "association-created"
    | "pool-member-added"
    | "marketplace-founded";

export interface ActivityLogEntry {
    id:          string;
    type:        ActivityLogType;
    summary:     string;
    actorId:     string | null;  // personId or system actor, null = system
    refId:       string | null;  // motionId, personId, etc.
    occurredAt:  string;         // ISO 8601
}

export function makeLogEntry(
    type:      ActivityLogType,
    summary:   string,
    opts:      { actorId?: string | null; refId?: string | null; occurredAt?: string } = {},
): ActivityLogEntry {
    return {
        id:         randomUUID(),
        type,
        summary,
        actorId:    opts.actorId    ?? null,
        refId:      opts.refId      ?? null,
        occurredAt: opts.occurredAt ?? new Date().toISOString(),
    };
}
