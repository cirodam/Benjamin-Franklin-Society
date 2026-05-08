import { randomUUID } from "crypto";
import {
    FederationMotion,
    type FederationMotionOutcome,
    type FederationVoteThresholdKey,
} from "./FederationMotion.js";
import type { FederationMotionLoader } from "./FederationMotionLoader.js";
import { FederationConstitution } from "./FederationConstitution.js";
import { FederationMemberService } from "../FederationMemberService.js";

const DEFAULT_DELIBERATION_DAYS = 7;
const DEFAULT_VOTING_DAYS       = 14;

export class FederationMotionService {
    private static instance: FederationMotionService;
    private loader!: FederationMotionLoader;
    private motions = new Map<string, FederationMotion>();

    private constructor() {}

    static getInstance(): FederationMotionService {
        if (!FederationMotionService.instance) {
            FederationMotionService.instance = new FederationMotionService();
        }
        return FederationMotionService.instance;
    }

    init(loader: FederationMotionLoader): void {
        this.loader = loader;
        this.motions = new Map(loader.loadAll().map(m => [m.id, m]));
        for (const m of this.motions.values()) {
            if (m.authorityId === "community" && m.stage === "voting" && m.votingClosesAt) {
                if (new Date() > new Date(m.votingClosesAt)) {
                    this.resolveByDeadline(m);
                }
            }
        }
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    getAll(): FederationMotion[] { return Array.from(this.motions.values()); }
    get(id: string): FederationMotion | undefined { return this.motions.get(id); }

    getByBody(body: string): FederationMotion[] {
        return this.getAll().filter(m => m.authorityId === body);
    }

    // ── Create ────────────────────────────────────────────────────────────────

    create(opts: {
        body:            string;
        title:           string;
        description:     string;
        proposerId:      string;
        proposerHandle:  string;
        parentId?:       string;
    }): FederationMotion {
        const motion = new FederationMotion({ ...opts, authorityId: opts.body });
        this.motions.set(motion.id, motion);
        this.loader.save(motion);
        return motion;
    }

    // ── Referendum lifecycle ──────────────────────────────────────────────────

    submitForDeliberation(
        motionId:     string,
        callerId:     string,
        thresholdKey: FederationVoteThresholdKey = "thresholdSimpleMajority",
    ): FederationMotion {
        const m = this.require(motionId);
        if (m.authorityId !== "community")           throw new Error("Only referendum motions use deliberation");
        if (m.stage !== "draft")       throw new Error("Motion is not a draft");
        if (m.proposerId !== callerId) throw new Error("Only the proposer can submit for deliberation");

        const now = new Date();
        const votingOpens = new Date(now);
        votingOpens.setDate(votingOpens.getDate() + DEFAULT_DELIBERATION_DAYS);

        m.stage                 = "deliberating";
        m.deliberationStartedAt = now.toISOString();
        m.votingOpensAt         = votingOpens.toISOString();
        m.thresholdKey          = thresholdKey;
        this.loader.save(m);
        return m;
    }

    openVoting(motionId: string): FederationMotion {
        const m = this.require(motionId);
        if (m.authorityId !== "community")            throw new Error("Only referendum motions use this transition");
        if (m.stage !== "deliberating") throw new Error("Motion is not in deliberation");
        if (m.pendingAmendmentIds.length > 0) throw new Error("Pending amendments must resolve first");
        if (m.votingOpensAt && new Date() < new Date(m.votingOpensAt)) {
            throw new Error("Deliberation period has not elapsed yet");
        }

        const closes = new Date();
        closes.setDate(closes.getDate() + DEFAULT_VOTING_DAYS);

        m.stage          = "voting";
        m.votingClosesAt = closes.toISOString();
        this.loader.save(m);
        return m;
    }

    castVote(
        motionId:        string,
        voterId:         string,
        communityHandle: string,
        vote:            "approve" | "reject" | "abstain",
    ): FederationMotion {
        const m = this.require(motionId);
        if (m.authorityId !== "community") throw new Error("Use clerk actions for assembly/council motions");
        if (m.stage !== "voting") throw new Error("Motion is not in voting stage");
        if (m.votingClosesAt && new Date() > new Date(m.votingClosesAt)) {
            this.resolveByDeadline(m);
            throw new Error("Voting period has closed");
        }
        if (m.hasVoted(voterId)) throw new Error("This community has already voted");

        m.votes.push({ voterId, voterHandle: communityHandle, vote, votedAt: new Date().toISOString() });
        this.loader.save(m);
        this.checkReferendumResolution(m);
        return m;
    }

    addComment(
        motionId:        string,
        communityHandle: string,
        authorHandle:    string,
        body:            string,
    ): FederationMotion {
        const m = this.require(motionId);
        if (m.stage === "draft" || m.stage === "resolved") {
            throw new Error("Comments can only be added during deliberation or voting");
        }
        m.comments.push({
            id:          randomUUID(),
            authorId:    "",
            authorHandle,
            groupHandle: communityHandle,
            body:        body.trim(),
            kind:        "general",
            createdAt:   new Date().toISOString(),
        });
        this.loader.save(m);
        return m;
    }

    // ── Clerk lifecycle (assembly / council) ──────────────────────────────────

    markDiscussed(motionId: string): FederationMotion {
        const m = this.require(motionId);
        if (m.authorityId === "community") throw new Error("Use referendum lifecycle for referendum motions");
        if (m.stage !== ("proposed" as string)) throw new Error("Motion must be in 'proposed' stage");
        (m as { stage: string }).stage = "discussed";
        this.loader.save(m);
        return m;
    }

    recordOutcome(
        motionId:   string,
        outcome:    FederationMotionOutcome,
        outcomeNote = "",
    ): FederationMotion {
        const m = this.require(motionId);
        if (m.authorityId === "community") throw new Error("Use referendum lifecycle for referendum motions");
        if (m.stage === "resolved") throw new Error("Motion already resolved");

        m.outcome     = outcome;
        m.outcomeNote = outcomeNote;
        m.stage       = "resolved";
        m.resolvedAt  = new Date().toISOString();
        this.loader.save(m);
        return m;
    }

    withdraw(motionId: string, callerId: string): FederationMotion {
        const m = this.require(motionId);
        if (m.proposerId !== callerId) throw new Error("Only the proposer can withdraw");
        if (m.isResolved)                    throw new Error("Motion already resolved");
        m.stage      = "resolved";
        m.outcome    = "withdrawn";
        m.resolvedAt = new Date().toISOString();
        this.loader.save(m);
        return m;
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    private require(id: string): FederationMotion {
        const m = this.motions.get(id);
        if (!m) throw new Error(`Motion "${id}" not found`);
        return m;
    }

    private totalVoters(): number {
        return FederationMemberService.getInstance().getAll().length;
    }

    private getThresholdFraction(key: string): number {
        try {
            const constitution = FederationConstitution.getInstance();
            return constitution["get"]<number>(key);
        } catch {
            return 0.51;
        }
    }

    private resolveByDeadline(m: FederationMotion): void {
        const total    = this.totalVoters();
        const fraction = this.getThresholdFraction(m.thresholdKey ?? "thresholdSimpleMajority");
        const needed   = Math.ceil(total * fraction);
        m.outcome     = m.approvalCount >= needed ? "passed" : "failed";
        m.stage       = "resolved";
        m.resolvedAt  = new Date().toISOString();
        m.outcomeNote = `Resolved at deadline. ${m.approvalCount}/${total} communities approved (needed ${needed}).`;
        this.loader.save(m);
    }

    private checkReferendumResolution(m: FederationMotion): void {
        const total    = this.totalVoters();
        const fraction = this.getThresholdFraction(m.thresholdKey ?? "thresholdSimpleMajority");
        const needed   = Math.ceil(total * fraction);

        if (m.approvalCount >= needed) {
            m.outcome    = "passed";
            m.stage      = "resolved";
            m.resolvedAt = new Date().toISOString();
            m.outcomeNote = `Passed with ${m.approvalCount}/${total} community approvals.`;
            this.loader.save(m);
            return;
        }

        const rejectMajority = Math.floor(total / 2) + 1;
        if (m.rejectionCount >= rejectMajority) {
            m.outcome    = "failed";
            m.stage      = "resolved";
            m.resolvedAt = new Date().toISOString();
            m.outcomeNote = `Rejected by ${m.rejectionCount}/${total} communities.`;
            this.loader.save(m);
        }
    }
}
