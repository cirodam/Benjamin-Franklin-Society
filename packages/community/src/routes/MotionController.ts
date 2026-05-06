import { Request, Response } from "express";
import { MotionService } from "../governance/MotionService.js";
import { Motion } from "../governance/Motion.js";
import { PersonService } from "../person/PersonService.js";
import { ConstitutionLoader } from "../governance/ConstitutionLoader.js";
import { effectRegistry } from "../governance/EffectRegistry.js";
import { AuthorityService } from "../governance/AuthorityService.js";
import { getVoteRule, listVoteRules } from "@ecf/core";

type AuthedRequest = Request & { personId?: string };

const svc = () => MotionService.getInstance();
const ppl = () => PersonService.getInstance();

function toDto(m: Motion) {
    const data = m.toData();
    // Strip internal UUIDs from the public DTO — handles are the member-facing identifiers.
    const { proposerId: _pid, body: _body, ...rest } = data as typeof data & { proposerId?: unknown; body?: unknown };
    return {
        ...rest,
        authorityId: m.authorityId,
        votes:    data.votes.map(({ personId: _vpid, ...v }) => v),
        comments: data.comments.map(({ authorId: _acid, ...c }) => c),
    };
}

// GET /api/motions?authorityId=assembly&stage=deliberating&kind=add-person
export function listMotions(req: Request, res: Response): void {
    const { authorityId, stage, kind } = req.query;
    let results = svc().getAll();
    if (typeof authorityId === "string") results = results.filter(m => m.authorityId === authorityId);
    if (typeof stage       === "string") results = results.filter(m => m.stage       === stage);
    if (typeof kind        === "string") results = results.filter(m => m.kind        === kind);
    results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json(results.map(toDto));
}

// GET /api/motions/:id
export function getMotion(req: Request, res: Response): void {
    const m = svc().get(req.params.id as string);
    if (!m) { res.status(404).json({ error: "Motion not found" }); return; }
    res.json(toDto(m));
}

// GET /api/authorities
export function listAuthorities(_req: Request, res: Response): void {
    res.json(AuthorityService.getInstance().getAll());
}

// GET /api/motions/effects
export function listEffects(_req: Request, res: Response): void {
    res.json(effectRegistry.listKinds());
}

// POST /api/motions
// Body: { authorityId, title, description, parentId?, kind?, payload? }
export function createMotion(req: AuthedRequest, res: Response): void {
    const personId = req.personId;
    if (!personId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { authorityId, title, description, parentId, kind, payload, premises, expectedOutcome } = req.body ?? {};

    if (typeof authorityId !== "string" || !authorityId.trim()) { res.status(400).json({ error: "authorityId is required" }); return; }
    if (typeof title !== "string" || !title.trim()) { res.status(400).json({ error: "title is required" }); return; }
    if (typeof description !== "string" || !description.trim()) { res.status(400).json({ error: "description is required" }); return; }

    // Validate effect kind + payload at creation time
    if (kind !== undefined && kind !== null) {
        if (typeof kind !== "string" || !kind.trim()) {
            res.status(400).json({ error: "kind must be a non-empty string" }); return;
        }
        const payloadErr = effectRegistry.validatePayload(kind.trim(), payload ?? {});
        if (payloadErr) { res.status(400).json({ error: payloadErr }); return; }
    }

    const person = ppl().get(personId);
    const handle = person?.handle ?? personId;

    const payloadJson = (kind && payload !== undefined && payload !== null)
        ? JSON.stringify(payload)
        : null;

    try {
        const motion = svc().create({
            authorityId:     authorityId.trim(),
            title:           title.trim(),
            description:     description.trim(),
            proposerId:      personId,
            proposerHandle:  handle,
            parentId:        typeof parentId === "string" ? parentId : undefined,
            kind:            typeof kind === "string" && kind.trim() ? kind.trim() : null,
            payload:         payloadJson,
            premises:        typeof premises === "string" && premises.trim() ? premises.trim() : null,
            expectedOutcome: typeof expectedOutcome === "string" && expectedOutcome.trim() ? expectedOutcome.trim() : null,
        });
        res.status(201).json(toDto(motion));
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}

// GET /api/motions/vote-rules
export function listVoteRulesList(_req: Request, res: Response): void {
    res.json(listVoteRules());
}

// POST /api/motions/:id/deliberate
// Body: { voteRuleId?, minApprovals? }
// If the motion's kind maps to a constitutional action, voteRuleId is ignored and
// the constitutionally mandated rule is used instead.
export function submitForDeliberation(req: AuthedRequest, res: Response): void {
    const personId = req.personId;
    if (!personId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { minApprovals } = req.body ?? {};

    const motion = svc().get(req.params.id as string);
    if (!motion) { res.status(404).json({ error: "Motion not found" }); return; }

    // If the motion kind is a constitutional action, the vote rule is mandated.
    const constitutionalRule = motion.kind
        ? ConstitutionLoader.getInstance().getRequiredVoteRule(motion.kind)
        : null;

    let resolvedRuleId: string;
    if (constitutionalRule) {
        resolvedRuleId = constitutionalRule;
    } else {
        const { voteRuleId } = req.body ?? {};
        if (typeof voteRuleId !== "string" || !voteRuleId.trim()) {
            res.status(400).json({ error: "voteRuleId is required for motions without a constitutional action kind" }); return;
        }
        resolvedRuleId = voteRuleId.trim();
    }

    let rule: ReturnType<typeof getVoteRule>;
    try {
        rule = getVoteRule(resolvedRuleId);
    } catch {
        res.status(400).json({ error: `Unknown voteRuleId '${resolvedRuleId}'. Valid values: ${listVoteRules().map(r => r.id).join(", ")}` }); return;
    }

    if (rule.legitimacy === "petition") {
        if (!Number.isInteger(minApprovals) || (minApprovals as number) < 1) {
            res.status(400).json({ error: "minApprovals must be a positive integer for petition rule" }); return;
        }
    }

    try {
        const updated = svc().submitForDeliberation(
            req.params.id as string,
            personId,
            resolvedRuleId,
            rule.legitimacy === "petition" ? (minApprovals as number) : undefined,
        );
        res.json(toDto(updated));
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}

// POST /api/motions/:id/open-voting
export function openVoting(req: AuthedRequest, res: Response): void {
    const personId = req.personId;
    if (!personId) { res.status(401).json({ error: "Unauthorized" }); return; }

    try {
        const motion = svc().openVoting(req.params.id as string, personId);
        res.json(toDto(motion));
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}

// POST /api/motions/:id/vote
// Body: { vote: "approve" | "reject" | "abstain" }
export function castVote(req: AuthedRequest, res: Response): void {
    const personId = req.personId;
    if (!personId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { vote } = req.body ?? {};
    const validVotes = ["approve", "reject", "abstain"];
    if (!validVotes.includes(vote as string)) {
        res.status(400).json({ error: `vote must be one of: ${validVotes.join(", ")}` }); return;
    }

    const person = ppl().get(personId);
    const handle = person?.handle ?? personId;

    try {
        const motion = svc().castVote(req.params.id as string, personId, handle, vote as "approve" | "reject" | "abstain");
        res.json(toDto(motion));
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}

// POST /api/motions/:id/comment
// Body: { body: string, kind?: "evidence" | "challenge" | "general" }
export function addComment(req: AuthedRequest, res: Response): void {
    const personId = req.personId;
    if (!personId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { body, kind } = req.body ?? {};
    if (typeof body !== "string" || !body.trim()) {
        res.status(400).json({ error: "body is required" }); return;
    }
    const validKinds = ["evidence", "challenge", "general"];
    const commentKind = validKinds.includes(kind) ? kind : "general";

    const person = ppl().get(personId);
    const handle = person?.handle ?? personId;

    try {
        const motion = svc().addComment(req.params.id as string, personId, handle, body.trim(), commentKind);
        res.json(toDto(motion));
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}

// POST /api/motions/:id/dissent
// Body: { body: string }
export function recordDissent(req: AuthedRequest, res: Response): void {
    const personId = req.personId;
    if (!personId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { body } = req.body ?? {};
    if (typeof body !== "string" || !body.trim()) {
        res.status(400).json({ error: "body is required" }); return;
    }

    const person = ppl().get(personId);
    const handle = person?.handle ?? personId;

    try {
        const motion = svc().recordDissent(req.params.id as string, handle, body.trim());
        res.json(toDto(motion));
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}

// POST /api/motions/:id/discuss  (admin override — force motion to deliberation)
export function markDiscussed(req: AuthedRequest, res: Response): void {
    const personId = req.personId;
    if (!personId) { res.status(401).json({ error: "Unauthorized" }); return; }
    try {
        const motion = svc().submitForDeliberation(req.params.id as string, personId);
        res.json(toDto(motion));
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}

// POST /api/motions/:id/outcome  (admin override — force-resolve)
export function recordOutcome(req: AuthedRequest, res: Response): void {
    const { outcome, outcomeNote } = req.body ?? {};
    const validOutcomes = ["passed", "failed", "withdrawn", "referred"];
    if (!validOutcomes.includes(outcome as string)) {
        res.status(400).json({ error: `outcome must be one of: ${validOutcomes.join(", ")}` }); return;
    }
    const m = svc().get(req.params.id as string);
    if (!m) { res.status(404).json({ error: "Motion not found" }); return; }
    if (m.isResolved) { res.status(400).json({ error: "Motion already resolved" }); return; }
    // Force-resolve without going through the normal lifecycle
    m.stage       = "resolved";
    m.outcome     = outcome as "passed" | "failed" | "withdrawn" | "referred";
    m.outcomeNote = typeof outcomeNote === "string" ? outcomeNote : "";
    m.resolvedAt  = new Date().toISOString();
    res.json(toDto(m));
}

// DELETE /api/motions/:id  (withdraw)
export function withdrawMotion(req: AuthedRequest, res: Response): void {
    const personId = req.personId;
    if (!personId) { res.status(401).json({ error: "Unauthorized" }); return; }

    try {
        const motion = svc().withdraw(req.params.id as string, personId);
        res.json(toDto(motion));
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}
