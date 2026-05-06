import {
    AssemblyMotion,
    AssemblyMotionData,
    type MotionStage,
    type MotionOutcome,
} from "@ecf/core";

// Re-export shared types so existing consumers of this module keep working.
export type { MotionStage, MotionOutcome };

// ── Types ─────────────────────────────────────────────────────────────────────

export type CommentKind = "evidence" | "challenge" | "general";

export interface MotionComment {
    id:           string;
    authorId:     string;
    authorHandle: string;
    body:         string;
    kind:         CommentKind;
    createdAt:    string; // ISO 8601
}

export interface MotionVote {
    personId: string;
    handle:   string;
    vote:     "approve" | "reject" | "abstain";
    votedAt:  string;
}

export interface MotionData extends AssemblyMotionData<MotionVote, MotionComment> {
    proposerId: string;
}

// ── Class ─────────────────────────────────────────────────────────────────────

export class Motion extends AssemblyMotion<MotionVote, MotionComment> {
    readonly proposerId: string;

    constructor(opts: {
        authorityId:     string;
        title:           string;
        description:     string;
        proposerId:      string;
        proposerHandle:  string;
        parentId?:       string | null;
        kind?:           string | null;
        payload?:        string | null;
        premises?:       string | null;
        expectedOutcome?: string | null;
        id?:             string;
        createdAt?:      string;
    }) {
        // Pass authorityId as body to the base class (body is the authority id).
        super({ ...opts, body: opts.authorityId });
        // All community motions follow a single lifecycle starting at "draft".
        this.stage           = "draft";
        this.proposerId      = opts.proposerId;
        this.premises        = opts.premises        ?? null;
        this.expectedOutcome = opts.expectedOutcome ?? null;
    }

    /** The authority that has jurisdiction over this motion. */
    get authorityId(): string { return this.body; }

    hasVoted(personId: string): boolean {
        return this.votes.some(v => v.personId === personId);
    }

    toData(): MotionData {
        return { ...this.baseData(), proposerId: this.proposerId };
    }

    static fromData(d: MotionData): Motion {
        const m = new Motion({
            id:             d.id,
            authorityId:    d.body,
            title:          d.title,
            description:    d.description,
            proposerId:     d.proposerId,
            proposerHandle: d.proposerHandle,
            parentId:       d.parentId,
            kind:           d.kind,
            payload:        d.payload,
            createdAt:      d.createdAt,
        });
        m.restoreBase(d);
        return m;
    }
}

