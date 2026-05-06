import type { Request, Response } from "express";
import { FederationAssemblyService } from "../governance/FederationAssemblyService.js";
import { FederationMotionService } from "../governance/FederationMotionService.js";
import { FederationMemberService } from "../FederationMemberService.js";
import { HealthInsuranceDomain } from "../domains/health_insurance/HealthInsuranceDomain.js";
import type { FederationMotion } from "../governance/FederationMotion.js";
import type { HealthInsuranceClaim } from "../domains/health_insurance/HealthInsuranceClaim.js";

// ── DTOs ──────────────────────────────────────────────────────────────────────

function motionToDto(m: FederationMotion) {
    return {
        id:                    m.id,
        body:                  m.authorityId,
        stage:                 m.stage,
        title:                 m.title,
        description:           m.description,
        proposerId:            m.proposerId,
        proposerHandle:        m.proposerHandle,
        createdAt:             m.createdAt,
        deliberationStartedAt: m.deliberationStartedAt,
        votingOpensAt:         m.votingOpensAt,
        votingClosesAt:        m.votingClosesAt,
        votes:                 m.votes,
        comments:              m.comments,
        outcome:               m.outcome,
        outcomeNote:           m.outcomeNote,
        resolvedAt:            m.resolvedAt,
        approvalCount:         m.approvalCount,
        rejectionCount:        m.rejectionCount,
    };
}

function claimToDto(c: HealthInsuranceClaim) {
    return {
        id:                c.id,
        communityMemberId: c.communityMemberId,
        communityHandle:   c.communityHandle,
        patientName:       c.patientName,
        reason:            c.reason,
        requestedKin:      c.requestedKin,
        approvedKin:       c.approvedKin,
        status:            c.status,
        transferId:        c.transferId,
        submittedAt:       c.submittedAt,
        reviewedAt:        c.reviewedAt,
        reviewNote:        c.reviewNote,
    };
}

// ── Assembly ──────────────────────────────────────────────────────────────────

/** GET /api/assembly — current term + seats */
export function getAssembly(_req: Request, res: Response): void {
    const term = FederationAssemblyService.getInstance().getCurrentTerm();
    if (!term) { res.json({ term: null }); return; }
    res.json({ term: term.toData() });
}

/** POST /api/assembly/terms — start a new assembly term */
export function startAssemblyTerm(_req: Request, res: Response): void {
    try {
        const term = FederationAssemblyService.getInstance().startNewTerm();
        res.status(201).json({ term: term.toData() });
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}

/** POST /api/assembly/delegates — seat or update a community's delegate */
export function seatDelegate(req: Request, res: Response): void {
    const { communityId, communityHandle, personHandle, personName } = req.body as {
        communityId?:    string;
        communityHandle?: string;
        personHandle?:   string;
        personName?:     string;
    };

    if (!communityId || !communityHandle || !personHandle || !personName) {
        res.status(400).json({ error: "communityId, communityHandle, personHandle, and personName are required" });
        return;
    }

    // Verify this community is a member
    const member = FederationMemberService.getInstance().getById(communityId);
    if (!member) { res.status(404).json({ error: "Community not found" }); return; }

    try {
        const term = FederationAssemblyService.getInstance().seatDelegate({
            communityId,
            communityHandle,
            personHandle,
            personName,
        });
        res.json({ term: term.toData() });
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}

/** DELETE /api/assembly/delegates/:communityMemberId — vacate a seat */
export function vacateSeat(req: Request, res: Response): void {
    try {
        const term = FederationAssemblyService.getInstance().vacateSeat(String(req.params.communityMemberId));
        res.json({ term: term.toData() });
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}

// ── Motions ───────────────────────────────────────────────────────────────────

/** GET /api/motions */
export function listMotions(_req: Request, res: Response): void {
    res.json(FederationMotionService.getInstance().getAll().map(motionToDto));
}

/** POST /api/motions */
export function createMotion(req: Request, res: Response): void {
    const { body, title, description, proposerMemberId, proposerHandle, parentId } = req.body as {
        body?:             string;
        title?:            string;
        description?:      string;
        proposerMemberId?: string;
        proposerHandle?:   string;
        parentId?:         string;
    };

    if (!body || !title || !description || !proposerMemberId || !proposerHandle) {
        res.status(400).json({ error: "body, title, description, proposerMemberId, and proposerHandle are required" });
        return;
    }

    // Verify the proposer is a member community
    if (!FederationMemberService.getInstance().getById(proposerMemberId)) {
        res.status(403).json({ error: "Proposer is not a federation member" });
        return;
    }

    try {
        const motion = FederationMotionService.getInstance().create({
            body, title, description,
            proposerId:     proposerMemberId,
            proposerHandle, parentId,
        });
        res.status(201).json(motionToDto(motion));
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}

/** GET /api/motions/:id */
export function getMotion(req: Request, res: Response): void {
    const motion = FederationMotionService.getInstance().get(String(req.params.id));
    if (!motion) { res.status(404).json({ error: "Motion not found" }); return; }
    res.json(motionToDto(motion));
}

/** PATCH /api/motions/:id — advance lifecycle or cast vote */
export function advanceMotion(req: Request, res: Response): void {
    const { action, thresholdKey, vote, communityMemberId, communityHandle, outcome, outcomeNote } = req.body as {
        action?:            string;
        thresholdKey?:      string;
        vote?:              string;
        communityMemberId?: string;
        communityHandle?:   string;
        outcome?:           string;
        outcomeNote?:       string;
    };

    const svc = FederationMotionService.getInstance();
    const id  = String(req.params.id);

    try {
        let motion;
        switch (action) {
            case "submit":
                motion = svc.submitForDeliberation(
                    id,
                    communityMemberId ?? "",
                    (thresholdKey as "thresholdSimpleMajority") ?? "thresholdSimpleMajority",
                );
                break;
            case "open-voting":
                motion = svc.openVoting(id);
                break;
            case "vote":
                if (!communityMemberId || !communityHandle || !vote) {
                    res.status(400).json({ error: "communityMemberId, communityHandle, and vote are required" });
                    return;
                }
                if (vote !== "approve" && vote !== "reject" && vote !== "abstain") {
                    res.status(400).json({ error: "vote must be approve, reject, or abstain" });
                    return;
                }
                motion = svc.castVote(id, communityMemberId, communityHandle, vote);
                break;
            case "record-outcome":
                if (!outcome) { res.status(400).json({ error: "outcome is required" }); return; }
                motion = svc.recordOutcome(id, outcome as "passed", outcomeNote ?? "");
                break;
            case "discussed":
                motion = svc.markDiscussed(id);
                break;
            case "withdraw":
                motion = svc.withdraw(id, communityMemberId ?? "");
                break;
            default:
                res.status(400).json({ error: `Unknown action "${action}"` });
                return;
        }
        res.json(motionToDto(motion));
    } catch (err) {
        res.status(422).json({ error: (err as Error).message });
    }
}

// ── Health Insurance ──────────────────────────────────────────────────────────

/** GET /api/insurance/claims */
export async function listInsuranceClaims(_req: Request, res: Response): Promise<void> {
    const domain = HealthInsuranceDomain.getInstance();
    if (!domain.isReady()) { res.status(503).json({ error: "Health insurance domain not ready" }); return; }
    const balance = await domain.poolBalance();
    res.json({ claims: domain.getAll().map(claimToDto), poolBalance: balance });
}

/** POST /api/insurance/claims */
export async function submitInsuranceClaim(req: Request, res: Response): Promise<void> {
    const domain = HealthInsuranceDomain.getInstance();
    if (!domain.isReady()) { res.status(503).json({ error: "Health insurance domain not ready" }); return; }

    const { communityMemberId, communityHandle, patientName, reason, requestedKin } = req.body as {
        communityMemberId?: string;
        communityHandle?:   string;
        patientName?:       string;
        reason?:            string;
        requestedKin?:      number;
    };

    if (!communityMemberId || !communityHandle || !patientName || !reason || !requestedKin) {
        res.status(400).json({ error: "communityMemberId, communityHandle, patientName, reason, and requestedKin are required" });
        return;
    }
    if (typeof requestedKin !== "number" || requestedKin <= 0) {
        res.status(400).json({ error: "requestedKin must be a positive number" });
        return;
    }

    try {
        const claim = await domain.submitClaim({ communityMemberId, communityHandle, patientName, reason, requestedKin });
        res.status(201).json(claimToDto(claim));
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}

/** GET /api/insurance/claims/:id */
export function getInsuranceClaim(req: Request, res: Response): void {
    const domain = HealthInsuranceDomain.getInstance();
    const claim  = domain.getById(String(req.params.id));
    if (!claim) { res.status(404).json({ error: "Claim not found" }); return; }
    res.json(claimToDto(claim));
}

/** PATCH /api/insurance/claims/:id — review (approve/reject) */
export async function reviewInsuranceClaim(req: Request, res: Response): Promise<void> {
    const domain = HealthInsuranceDomain.getInstance();
    if (!domain.isReady()) { res.status(503).json({ error: "Health insurance domain not ready" }); return; }

    const { status, approvedKin, reviewNote } = req.body as {
        status?:      string;
        approvedKin?: number;
        reviewNote?:  string;
    };

    if (status !== "approved" && status !== "rejected") {
        res.status(400).json({ error: "status must be approved or rejected" });
        return;
    }

    try {
        const claim = await domain.reviewClaim({
            claimId:    String(req.params.id),
            status,
            approvedKin,
            reviewNote,
        });
        res.json(claimToDto(claim));
    } catch (err) {
        res.status(422).json({ error: (err as Error).message });
    }
}
