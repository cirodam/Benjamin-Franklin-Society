import { Request, Response } from "express";
import { MotionService } from "../governance/MotionService.js";
import { Motion } from "@ecf/core";
import { PersonService } from "../person/PersonService.js";
import { DocumentReconciler } from "../governance/DocumentReconciler.js";
import { DocumentLoader } from "../governance/DocumentLoader.js";
import { effectRegistry } from "@ecf/core";
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
        votes:    data.votes.map(({ voterId: _vpid, ...v }) => v),
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
    const reconciler = DocumentReconciler.getInstance();
    const authorities = AuthorityService.getInstance().getAll();
    res.json(authorities.map(a => ({
        id:                a.id,
        name:              a.name,
        description:       a.description,
        kind:              a.kind,
        defaultVoteRuleId: a.defaultVoteRuleId,
        powers:            reconciler.getPowers(a.id),
    })));
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

    if (typeof title !== "string" || !title.trim()) { res.status(400).json({ error: "title is required" }); return; }
    if (typeof description !== "string" || !description.trim()) { res.status(400).json({ error: "description is required" }); return; }

    // Validate effect kind + payload at creation time
    let resolvedAuthorityId: string | undefined;
    if (kind !== undefined && kind !== null) {
        if (typeof kind !== "string" || !kind.trim()) {
            res.status(400).json({ error: "kind must be a non-empty string" }); return;
        }
        const payloadErr = effectRegistry.validatePayload(kind.trim(), payload ?? {});
        if (payloadErr) { res.status(400).json({ error: payloadErr }); return; }

        // Resolve the governing authority from the power cache (directive-based).
        const governed = DocumentReconciler.getInstance().getAuthorityForAction(kind.trim());
        if (governed) {
            // If the caller also supplied an authorityId, it must match.
            if (typeof authorityId === "string" && authorityId.trim() && authorityId.trim() !== governed.authorityId) {
                res.status(403).json({
                    error: `Action "${kind.trim()}" is governed by authority "${governed.authorityId}" — ` +
                           `cannot assign it to "${authorityId.trim()}".`,
                }); return;
            }
            resolvedAuthorityId = governed.authorityId;
        }
    }

    // Fall back to caller-supplied authorityId for free-form motions (no governed action kind).
    if (!resolvedAuthorityId) {
        if (typeof authorityId !== "string" || !authorityId.trim()) {
            res.status(400).json({ error: "authorityId is required for motions without a governed action kind" }); return;
        }
        resolvedAuthorityId = authorityId.trim();
    }

    const person = ppl().get(personId);
    const handle = person?.handle ?? personId;

    const payloadJson = (kind && payload !== undefined && payload !== null)
        ? JSON.stringify(payload)
        : null;

    try {
        const motion = svc().create({
            authorityId:     resolvedAuthorityId,
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

    // If the motion kind is a governed action, the vote rule is mandated by the power cache.
    const govEntry = motion.kind
        ? DocumentReconciler.getInstance().getAuthorityForAction(motion.kind)
        : null;

    let resolvedRuleId: string;
    if (govEntry) {
        resolvedRuleId = govEntry.voteRuleId;
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
        // If caller didn't supply minApprovals, read petitionThreshold from the membership bylaw.
        let resolvedMin: number | undefined =
            (Number.isInteger(minApprovals) && (minApprovals as number) >= 1)
                ? (minApprovals as number)
                : undefined;
        if (resolvedMin === undefined) {
            try {
                const threshold = new DocumentLoader().getParam<number>("membership", "petitionThreshold");
                if (typeof threshold === "number" && Number.isInteger(threshold) && threshold >= 1) {
                    resolvedMin = threshold;
                }
            } catch { /* membership bylaw not yet seeded */ }
        }
        if (resolvedMin === undefined) {
            res.status(400).json({ error: "minApprovals must be a positive integer for petition rule (or seed the membership bylaw)" }); return;
        }
        try {
            const updated = svc().submitForDeliberation(
                req.params.id as string, personId, resolvedRuleId, resolvedMin,
            );
            res.json(toDto(updated));
        } catch (err) {
            res.status(400).json({ error: (err as Error).message });
        }
        return;
    }

    try {
        const updated = svc().submitForDeliberation(
            req.params.id as string,
            personId,
            resolvedRuleId,
            undefined,
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

// POST /api/motions/:id/deliberate  (steward override — advance to deliberation)
export function submitDeliberation(req: AuthedRequest, res: Response): void {
    const personId = req.personId;
    if (!personId) { res.status(401).json({ error: "Unauthorized" }); return; }
    try {
        const motion = svc().submitForDeliberation(req.params.id as string, personId);
        res.json(toDto(motion));
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}

// POST /api/motions/:id/outcome  (steward override — force-resolve)
export function recordOutcome(req: AuthedRequest, res: Response): void {
    const { outcome, outcomeNote } = req.body ?? {};
    const validOutcomes = ["passed", "failed", "withdrawn", "referred"];
    if (!validOutcomes.includes(outcome as string)) {
        res.status(400).json({ error: `outcome must be one of: ${validOutcomes.join(", ")}` }); return;
    }
    try {
        const m = svc().forceResolve(
            req.params.id as string,
            outcome as "passed" | "failed" | "withdrawn" | "referred",
            typeof outcomeNote === "string" ? outcomeNote : "",
        );
        if (m.outcome === "passed") {
            try { effectRegistry.dispatch(m); } catch { /* non-fatal */ }
        }
        res.json(toDto(m));
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
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
