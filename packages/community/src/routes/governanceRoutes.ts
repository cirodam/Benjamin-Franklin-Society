import { Router, Request, Response } from "express";
import { requireAuth, requireSteward } from "./middleware.js";
import * as motions   from "./MotionController.js";
import { DocumentLoader } from "../governance/DocumentLoader.js";
import { AuthorityLoader } from "../governance/AuthorityLoader.js";
import { PersonService } from "../person/PersonService.js";
import { CommunityLogService } from "../log/CommunityLogService.js";
import { Assembly, AssemblyTerm, type AssemblyTermData, currentTermWindow, nextTermStartDate } from "@ecf/core";
import { CommunityDb } from "../CommunityDb.js";

const router = Router();
const bylaws = new DocumentLoader();

router.get(   "/authorities",                motions.listAuthorities);
router.get(   "/motions/vote-rules",          motions.listVoteRulesList);
router.get(   "/motions/effects",            motions.listEffects);
router.get(   "/motions",                    motions.listMotions);
router.get(   "/motions/:id",                motions.getMotion);
router.post(  "/motions",                    requireAuth,    motions.createMotion);
router.post(  "/motions/:id/deliberate",     requireAuth,    motions.submitForDeliberation);
 router.post(  "/motions/:id/open-voting",    requireAuth,    motions.openVoting);
 router.post(  "/motions/:id/vote",           requireAuth,    motions.castVote);
 router.post(  "/motions/:id/comment",        requireAuth,    motions.addComment);
 router.post(  "/motions/:id/dissent",        requireAuth,    motions.recordDissent);
 router.post(  "/motions/:id/discuss",        requireSteward, motions.submitDeliberation);
router.post(  "/motions/:id/outcome",        requireSteward, motions.recordOutcome);
router.delete("/motions/:id",                requireAuth,    motions.withdrawMotion);

// PATCH /api/documents/constitution/parameters/:key
// Body: { value: number | boolean }
// Steward-only direct override — for experimental use.
router.patch("/documents/constitution/parameters/:key", requireSteward, (req: Request, res: Response) => {
    const key = req.params.key as string;
    const { value } = (req.body ?? {}) as { value?: unknown };
    if (typeof value !== "number" && typeof value !== "boolean") {
        res.status(400).json({ error: "value must be a number or boolean" }); return;
    }
    try {
        const docs = new DocumentLoader();
        docs.amend("constitution", key, value, "steward-override");
        res.json({ key, value: docs.getParam("constitution", key) });
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
});

// PATCH /api/documents/constitution/sections/:sectionId
// Body: { body: string }
// Steward-only direct override of a section's prose text.
router.patch("/documents/constitution/sections/:sectionId", requireSteward, (req: Request, res: Response) => {
    const sectionId = req.params.sectionId as string;
    const { body } = (req.body ?? {}) as { body?: unknown };
    if (typeof body !== "string" || !body.trim()) {
        res.status(400).json({ error: "body is required and must be a non-empty string" }); return;
    }
    try {
        const docs = new DocumentLoader();
        res.json(docs.updateSection("constitution", sectionId, body.trim()));
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
});

// GET /api/charter — keep old path as alias
router.get("/charter", (_req: Request, res: Response) => {
    const charter = bylaws.load("charter");
    if (!charter) { res.status(404).json({ error: "Charter not found" }); return; }
    res.json(charter);
});

// GET /api/documents/:id
router.get("/documents/:id", (req: Request, res: Response) => {
    const doc = bylaws.load(req.params.id as string);
    if (!doc) { res.status(404).json({ error: "Document not found" }); return; }
    res.json(doc);
});

// ── Bylaws ────────────────────────────────────────────────────────────────────

// The charter is immutable from within the community — reject any write attempt.
function rejectCharter(req: Request, res: Response, next: () => void): void {
    if (req.params.id === "charter") {
        res.status(403).json({ error: "The charter is maintained by the network and cannot be modified here." });
        return;
    }
    next();
}

router.get("/bylaws", (_req: Request, res: Response) => {
    res.json(bylaws.loadAll({ excludeIds: ["constitution", "charter"] }));
});

router.get("/bylaws/:id", (req: Request, res: Response) => {
    const bylaw = bylaws.load(req.params.id as string);
    if (!bylaw) { res.status(404).json({ error: "Bylaw not found" }); return; }
    res.json(bylaw);
});

router.post("/bylaws", requireSteward, (req: Request, res: Response) => {
    const { title, preamble, authorityId, voteRuleId } = (req.body ?? {}) as { title?: string; preamble?: string; authorityId?: string; voteRuleId?: string };
    if (!title?.trim()) { res.status(400).json({ error: "title is required" }); return; }
    try {
        res.status(201).json(bylaws.create(title, preamble, authorityId, null, undefined, voteRuleId));
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
});

router.post("/bylaws/:id/articles", requireSteward, rejectCharter, (req: Request, res: Response) => {
    const { number, title, preamble } = (req.body ?? {}) as { number?: string; title?: string; preamble?: string };
    if (!number?.trim() || !title?.trim()) { res.status(400).json({ error: "number and title are required" }); return; }
    try {
        res.status(201).json(bylaws.addArticle(req.params.id as string, number, title, preamble));
    } catch (err) {
        const msg = (err as Error).message;
        res.status(msg.includes("not found") ? 404 : 409).json({ error: msg });
    }
});

router.post("/bylaws/:id/articles/:number/sections", requireSteward, rejectCharter, (req: Request, res: Response) => {
    const { sectionId, title, body, rationale, sunsetAt, voteRuleId } = (req.body ?? {}) as { sectionId?: string; title?: string; body?: string; rationale?: string; sunsetAt?: string | null; voteRuleId?: string | null };
    if (!sectionId?.trim() || !body?.trim()) { res.status(400).json({ error: "sectionId and body are required" }); return; }
    try {
        res.status(201).json(bylaws.addSection(req.params.id as string, req.params.number as string, sectionId, title ?? "", body, { rationale, sunsetAt, voteRuleId }));
    } catch (err) {
        const msg = (err as Error).message;
        res.status(msg.includes("not found") ? 404 : 409).json({ error: msg });
    }
});

router.patch("/bylaws/:id/sections/:sectionId", requireSteward, rejectCharter, (req: Request, res: Response) => {
    const { body } = (req.body ?? {}) as { body?: string };
    if (!body?.trim()) { res.status(400).json({ error: "body is required" }); return; }
    try {
        res.json(bylaws.updateSection(req.params.id as string, req.params.sectionId as string, body));
    } catch (err) {
        const msg = (err as Error).message;
        res.status(msg.includes("not found") ? 404 : 400).json({ error: msg });
    }
});

router.delete("/bylaws/:id", requireSteward, rejectCharter, (req: Request, res: Response) => {
    if (!bylaws.load(req.params.id as string)) { res.status(404).json({ error: "Bylaw not found" }); return; }
    bylaws.delete(req.params.id as string);
    res.status(204).end();
});

// ── Assembly term ─────────────────────────────────────────────────────────────

function loadAssembly(): Assembly {
    const a = AuthorityLoader.getInstance().load("assembly");
    if (a instanceof Assembly) return a;
    // Fallback: create a blank one (should always exist after seeding)
    return new Assembly("assembly", "Assembly", "simple-majority");
}

function computeSeats(): number {
    return new DocumentLoader().getParam<number>("constitution", "assemblySeatCount");
}

function personToSlimDto(p: { id: string; firstName: string; lastName: string; handle: string }) {
    return { id: p.id, firstName: p.firstName, lastName: p.lastName, handle: p.handle };
}

// GET /api/governance/assembly
router.get("/assembly", (_req: Request, res: Response) => {
    const persons = PersonService.getInstance().getAll().filter(p => !p.disabled);
    const seats   = computeSeats();
    const asm     = loadAssembly();
    const docs    = new DocumentLoader();
    const cp = <T extends number | boolean>(k: string) => docs.getParam<T>("constitution", k);

    const seatedPersons = asm.memberIds
        .map(id => PersonService.getInstance().get(id))
        .filter(Boolean)
        .map(p => personToSlimDto(p!));

    const termParams = { startMonth: cp<number>("assemblyTermStartMonth"), startDay: cp<number>("assemblyTermStartDay"), termMonths: cp<number>("assemblyTermMonths") };
    const termWindow = currentTermWindow(termParams);

    res.json({
        seats,
        termMonths:             cp<number>("assemblyTermMonths"),
        termStartMonth:         cp<number>("assemblyTermStartMonth"),
        termStartDay:           cp<number>("assemblyTermStartDay"),
        canonicalTermStartDate: termWindow.start.toISOString().slice(0, 10),
        canonicalTermEndDate:   termWindow.end.toISOString().slice(0, 10),
        termStartDate:          asm.termStartedAt,
        population:             persons.length,
        seated:                 seatedPersons,
    });
});

// POST /api/governance/assembly/draw  (steward only)
// Randomly draws a new assembly term from eligible (non-disabled, adult) members.
router.post("/assembly/draw", requireSteward, (req: Request, res: Response) => {
    const { termStartDate } = (req.body ?? {}) as { termStartDate?: string };
    const docs = new DocumentLoader();
    const cp = <T extends number | boolean>(k: string) => docs.getParam<T>("constitution", k);
    const termParams = { startMonth: cp<number>("assemblyTermStartMonth"), startDay: cp<number>("assemblyTermStartDay"), termMonths: cp<number>("assemblyTermMonths") };
    // Default to the constitution's canonical term start date for the current cycle
    const startDate = termStartDate ?? currentTermWindow(termParams).start.toISOString().slice(0, 10);
    if (isNaN(new Date(startDate).getTime())) {
        res.status(400).json({ error: "termStartDate must be a valid date" }); return;
    }

    const workingMin   = cp<number>("workingAgeMin");
    const now          = new Date();
    const eligible     = PersonService.getInstance().getAll()
        .filter(p => !p.disabled && p.getAgeYears(now) >= workingMin);

    const seats = computeSeats();

    // Fisher-Yates shuffle, take first `seats` elements
    const pool = [...eligible];
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
    const drawn = pool.slice(0, seats);

    const asm = loadAssembly();
    asm.memberIds     = drawn.map(p => p.id);
    asm.termStartedAt = startDate;
    asm.termEndsAt    = currentTermWindow(termParams).end.toISOString().slice(0, 10);
    AuthorityLoader.getInstance().save(asm);

    // Record a historical term for audit trail
    const db = CommunityDb.getInstance().db;
    const prevRow = db.prepare("SELECT data FROM assembly_terms ORDER BY json_extract(data, '$.termNumber') DESC LIMIT 1").get() as { data: string } | undefined;
    const termNumber = prevRow ? (JSON.parse(prevRow.data) as AssemblyTermData).termNumber + 1 : 1;
    const term = new AssemblyTerm({
        termNumber,
        startedAt: new Date(startDate).toISOString(),
        endsAt:    asm.termEndsAt,
        seats:     drawn.map(p => ({
            personId:     p.id,
            personHandle: p.handle,
            seatedAt:     new Date().toISOString(),
        })),
    });
    db.prepare("INSERT INTO assembly_terms (id, data) VALUES (?, ?)").run(term.id, JSON.stringify(term.toData()));

    try {
        CommunityLogService.getInstance().write(
            "assembly-drawn",
            `A new assembly of ${drawn.length} member${drawn.length === 1 ? "" : "s"} was drawn by sortition for the term beginning ${startDate}.`,
            { actorId: (req as any).person?.id ?? null },
        );
    } catch { /* non-fatal */ }

    res.json({
        seats,
        termMonths:             cp<number>("assemblyTermMonths"),
        termStartMonth:         cp<number>("assemblyTermStartMonth"),
        termStartDay:           cp<number>("assemblyTermStartDay"),
        canonicalTermStartDate: currentTermWindow(termParams).start.toISOString().slice(0, 10),
        canonicalTermEndDate:   currentTermWindow(termParams).end.toISOString().slice(0, 10),
        termStartDate:          startDate,
        population:             eligible.length,
        seated:                 drawn.map(p => personToSlimDto(p)),
    });
});

// DELETE /api/governance/assembly  (steward only) — clear current term
router.delete("/assembly", requireSteward, (_req: Request, res: Response) => {
    const asm = loadAssembly();
    asm.memberIds     = [];
    asm.termStartedAt = null;
    asm.termEndsAt    = null;
    AuthorityLoader.getInstance().save(asm);
    res.status(204).end();
});

export default router;
