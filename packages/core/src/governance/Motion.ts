import { randomUUID } from "crypto";

// ── Stage / outcome types ─────────────────────────────────────────────────────

export type MotionStage =
    | "draft"          // not yet submitted
    | "deliberating"   // submitted; deliberation period running
    | "voting"         // voting window open
    | "resolved";      // terminal

export type MotionOutcome = "passed" | "failed" | "withdrawn" | "referred";

// ── Vote / comment / dissent shapes ──────────────────────────────────────────

export interface MotionVote {
    /** Person ID in a community motion; community-member ID in a federation motion. */
    voterId:     string;
    /** Display handle of the voter. */
    voterHandle: string;
    vote:        "approve" | "reject" | "abstain";
    votedAt:     string;
}

export interface MotionComment {
    id:           string;
    /** Person ID or empty string when the commenter is identified only by handle. */
    authorId:     string;
    authorHandle: string;
    /**
     * Optional group identifier for federation contexts — the community handle
     * that the commenter is representing.
     */
    groupHandle?: string;
    body:         string;
    /** "evidence" | "challenge" | "general" or any domain-specific kind. */
    kind:         string;
    createdAt:    string;
}

export interface MotionDissent {
    authorHandle: string;
    body:         string;
    recordedAt:   string;
}

// ── Serialisation shape ───────────────────────────────────────────────────────

export interface MotionData {
    id:                    string;
    /** The authority ID this motion is addressed to (replaces the old "body" field). */
    authorityId:           string;
    stage:                 MotionStage;
    title:                 string;
    description:           string;
    proposerId:            string;
    proposerHandle:        string;
    createdAt:             string;
    deliberationStartedAt: string | null;
    votingOpensAt:         string | null;
    votingClosesAt:        string | null;
    minApprovals:          number | null;
    voteRuleId:            string | null;
    premises:              string | null;
    expectedOutcome:       string | null;
    votes:                 MotionVote[];
    comments:              MotionComment[];
    dissents:              MotionDissent[];
    outcome:               MotionOutcome | null;
    outcomeNote:           string;
    resolvedAt:            string | null;
    referredToId:          string | null;
    parentId:              string | null;
    pendingAmendmentIds:   string[];
    kind:                  string | null;
    payload:               string | null;
    /** Optional threshold key for federation referendum resolution (e.g. "thresholdSimpleMajority"). */
    thresholdKey:          string | null;
}

// ── Class ─────────────────────────────────────────────────────────────────────

export class Motion {
    readonly id:             string;
    readonly authorityId:    string;
    readonly proposerId:     string;
    readonly proposerHandle: string;
    readonly title:          string;
    readonly description:    string;
    readonly createdAt:      string;
    readonly parentId:       string | null;

    stage:                 MotionStage       = "draft";
    deliberationStartedAt: string | null     = null;
    votingOpensAt:         string | null     = null;
    votingClosesAt:        string | null     = null;
    minApprovals:          number | null     = null;
    voteRuleId:            string | null     = null;
    premises:              string | null     = null;
    expectedOutcome:       string | null     = null;
    votes:                 MotionVote[]      = [];
    comments:              MotionComment[]   = [];
    dissents:              MotionDissent[]   = [];
    outcome:               MotionOutcome | null = null;
    outcomeNote:           string            = "";
    resolvedAt:            string | null     = null;
    referredToId:          string | null     = null;
    pendingAmendmentIds:   string[]          = [];
    kind:                  string | null     = null;
    payload:               string | null     = null;
    thresholdKey:          string | null     = null;

    constructor(opts: {
        authorityId:      string;
        title:            string;
        description:      string;
        proposerId:       string;
        proposerHandle:   string;
        parentId?:        string | null;
        kind?:            string | null;
        payload?:         string | null;
        premises?:        string | null;
        expectedOutcome?: string | null;
        id?:              string;
        createdAt?:       string;
    }) {
        this.id             = opts.id             ?? randomUUID();
        this.authorityId    = opts.authorityId;
        this.proposerId     = opts.proposerId;
        this.proposerHandle = opts.proposerHandle;
        this.title          = opts.title;
        this.description    = opts.description;
        this.parentId       = opts.parentId       ?? null;
        this.createdAt      = opts.createdAt      ?? new Date().toISOString();
        this.kind           = opts.kind            ?? null;
        this.payload        = opts.payload         ?? null;
        this.premises       = opts.premises        ?? null;
        this.expectedOutcome = opts.expectedOutcome ?? null;
    }

    // ── Computed ──────────────────────────────────────────────────────────────

    get isResolved(): boolean   { return this.stage === "resolved"; }
    get approvalCount(): number { return this.votes.filter(v => v.vote === "approve").length; }
    get rejectionCount(): number { return this.votes.filter(v => v.vote === "reject").length; }

    hasVoted(voterId: string): boolean {
        return this.votes.some(v => v.voterId === voterId);
    }

    // ── Serialisation ─────────────────────────────────────────────────────────

    toData(): MotionData {
        return {
            id:                    this.id,
            authorityId:           this.authorityId,
            stage:                 this.stage,
            title:                 this.title,
            description:           this.description,
            proposerId:            this.proposerId,
            proposerHandle:        this.proposerHandle,
            createdAt:             this.createdAt,
            deliberationStartedAt: this.deliberationStartedAt,
            votingOpensAt:         this.votingOpensAt,
            votingClosesAt:        this.votingClosesAt,
            minApprovals:          this.minApprovals,
            voteRuleId:            this.voteRuleId,
            premises:              this.premises,
            expectedOutcome:       this.expectedOutcome,
            votes:                 this.votes,
            comments:              this.comments,
            dissents:              this.dissents,
            outcome:               this.outcome,
            outcomeNote:           this.outcomeNote,
            resolvedAt:            this.resolvedAt,
            referredToId:          this.referredToId,
            parentId:              this.parentId,
            pendingAmendmentIds:   this.pendingAmendmentIds,
            kind:                  this.kind,
            payload:               this.payload,
            thresholdKey:          this.thresholdKey,
        };
    }

    static fromData(d: MotionData): Motion {
        const m = new Motion({
            id:             d.id,
            authorityId:    d.authorityId,
            title:          d.title,
            description:    d.description,
            proposerId:     d.proposerId,
            proposerHandle: d.proposerHandle,
            parentId:       d.parentId,
            kind:           d.kind,
            payload:        d.payload,
            createdAt:      d.createdAt,
        });
        m.stage                 = d.stage;
        m.deliberationStartedAt = d.deliberationStartedAt;
        m.votingOpensAt         = d.votingOpensAt;
        m.votingClosesAt        = d.votingClosesAt;
        m.minApprovals          = d.minApprovals ?? null;
        m.voteRuleId            = d.voteRuleId   ?? null;
        m.premises              = d.premises      ?? null;
        m.expectedOutcome       = d.expectedOutcome ?? null;
        m.votes                 = d.votes;
        m.comments              = d.comments;
        m.dissents              = d.dissents      ?? [];
        m.outcome               = d.outcome;
        m.outcomeNote           = d.outcomeNote;
        m.resolvedAt            = d.resolvedAt;
        m.referredToId          = d.referredToId;
        m.pendingAmendmentIds   = d.pendingAmendmentIds;
        m.kind                  = d.kind          ?? null;
        m.payload               = d.payload       ?? null;
        m.thresholdKey          = d.thresholdKey  ?? null;
        return m;
    }
}

