import { Router, Request, Response } from "express";
import { requireAuth, requireSteward } from "./middleware.js";
import * as motions   from "./MotionController.js";
import { DocumentLoader } from "../governance/DocumentLoader.js";
import { AuthorityLoader } from "../governance/AuthorityLoader.js";
import { PersonService } from "../person/PersonService.js";
import { ActivityLogService } from "@ecf/core";
import { Assembly, AssemblyTerm, type AssemblyTermData, currentTermWindow, nextTermStartDate, parseDirective } from "@ecf/core";
import type { DocumentDirective, GoverningDocument } from "@ecf/core";
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

// GET /api/documents/:id/print
// Returns a clean, self-contained HTML page suitable for printing or archiving.
// Each section that carries directives gets an "Effect on software" block that
// describes what the directive does in plain language.
router.get("/documents/:id/print", (req: Request, res: Response) => {
    const doc = bylaws.load(req.params.id as string);
    if (!doc) { res.status(404).json({ error: "Document not found" }); return; }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(renderPrintHtml(doc));
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
    const { sectionId, title, body, rationale, voteRuleId } = (req.body ?? {}) as { sectionId?: string; title?: string; body?: string; rationale?: string; voteRuleId?: string | null };
    if (!sectionId?.trim() || !body?.trim()) { res.status(400).json({ error: "sectionId and body are required" }); return; }
    try {
        res.status(201).json(bylaws.addSection(req.params.id as string, req.params.number as string, sectionId, title ?? "", body, { rationale, voteRuleId }));
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
        ActivityLogService.getInstance().write(
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

// ── Print renderer ────────────────────────────────────────────────────────────

function esc(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function renderDirectiveEffect(d: DocumentDirective): string {
    const parsed = parseDirective(d);
    if (!parsed) return "";

    if (d.verb === "authority.define") {
        const p = parsed as { id: string; kind: string; defaultVoteRuleId: string; description: string };
        const kindLabels: Record<string, string> = {
            assembly:      "Sortition Assembly",
            committee:     "Committee",
            "leader-pool": "Leader Pool",
            membership:    "Full Membership",
            referendum:    "Referendum",
        };
        const kind = kindLabels[p.kind] ?? p.kind;
        return `Provisions a <strong>${esc(kind)}</strong> governing authority with id <code>${esc(p.id)}</code>, ` +
               `default vote rule <code>${esc(p.defaultVoteRuleId)}</code>.`;
    }

    if (d.verb === "authority.grant") {
        const p = parsed as { authorityId: string; action: string; voteRuleId: string };
        return `Grants authority <code>${esc(p.authorityId)}</code> the power to perform ` +
               `<strong>${esc(p.action)}</strong> motions under vote rule <code>${esc(p.voteRuleId)}</code>.`;
    }

    if (d.verb === "parameter.define") {
        const p = parsed as { key: string; value: number | boolean; immutable: boolean; min?: number; max?: number; description: string };
        let constraints = "";
        if (p.min !== undefined && p.max !== undefined) {
            constraints = ` (range: ${p.min}–${p.max})`;
        } else if (p.min !== undefined) {
            constraints = ` (min: ${p.min})`;
        } else if (p.max !== undefined) {
            constraints = ` (max: ${p.max})`;
        }
        const lock = p.immutable ? " This parameter is <strong>immutable</strong> and cannot be changed by amendment." : "";
        return `Sets system parameter <code>${esc(p.key)}</code> to <strong>${esc(String(p.value))}</strong>${esc(constraints)}.${lock}`;
    }

    if (d.verb === "document.require") {
        const type = d.args[0] ?? "";
        const desc = d.args.slice(1).join(" ");
        return `Requires a governing document of type <code>${esc(type)}</code> to exist${desc ? ": " + esc(desc) : ""}.`;
    }

    return "";
}

function renderPrintHtml(doc: GoverningDocument): string {
    const adoptedDate = doc.adoptedAt ? new Date(doc.adoptedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "";
    const expiresDate = doc.expiresAt ? new Date(doc.expiresAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : null;

    let body = "";

    if (doc.preamble) {
        body += `<div class="preamble"><p>${esc(doc.preamble)}</p></div>\n`;
    }

    for (const article of doc.articles) {
        body += `<article>\n`;
        body += `  <h2>Article ${esc(article.number)}${article.title ? " — " + esc(article.title) : ""}</h2>\n`;
        if (article.preamble) {
            body += `  <p class="article-preamble">${esc(article.preamble)}</p>\n`;
        }

        for (const section of article.sections) {
            body += `  <section>\n`;
            body += `    <h3>§${esc(section.id)}${section.title ? " — " + esc(section.title) : ""}</h3>\n`;
            body += `    <div class="section-body"><p>${esc(section.body ?? "")}</p></div>\n`;

            if (section.rationale) {
                body += `    <details class="rationale">\n`;
                body += `      <summary>Rationale</summary>\n`;
                body += `      <p>${esc(section.rationale)}</p>\n`;
                body += `    </details>\n`;
            }

            const directives = section.directives ?? [];
            if (directives.length > 0) {
                const effects = directives
                    .map(d => renderDirectiveEffect(d))
                    .filter(Boolean);
                if (effects.length > 0) {
                    body += `    <aside class="effect-on-software">\n`;
                    body += `      <h4>Effect on software</h4>\n`;
                    body += `      <ul>\n`;
                    for (const e of effects) {
                        body += `        <li>${e}</li>\n`;
                    }
                    body += `      </ul>\n`;
                    body += `    </aside>\n`;
                }
            }

            body += `  </section>\n`;
        }

        body += `</article>\n`;
    }

    const typeLabel = (doc.type ?? "document").charAt(0).toUpperCase() + (doc.type ?? "document").slice(1);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(doc.title)} — ${esc(typeLabel)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: Georgia, "Times New Roman", serif;
      font-size: 12pt;
      line-height: 1.6;
      max-width: 720px;
      margin: 2rem auto;
      padding: 0 1.5rem;
      color: #111;
    }
    h1 { font-size: 1.6rem; margin-bottom: 0.25rem; }
    h2 { font-size: 1.2rem; margin-top: 2.5rem; border-bottom: 1px solid #ccc; padding-bottom: 0.25rem; }
    h3 { font-size: 1rem; margin-top: 1.5rem; margin-bottom: 0.25rem; }
    h4 { font-size: 0.9rem; margin: 0 0 0.35rem; color: #444; }
    p { margin: 0.5rem 0; }
    code { font-family: "Courier New", monospace; font-size: 0.88em; background: #f4f4f4; padding: 0 0.2em; border-radius: 2px; }
    .doc-meta { font-size: 0.85rem; color: #555; margin-bottom: 1.5rem; }
    .preamble { border-left: 3px solid #ccc; padding-left: 1rem; margin: 1rem 0 2rem; font-style: italic; color: #333; }
    .article-preamble { font-style: italic; color: #444; }
    .section-body p { text-align: justify; }
    .rationale { margin-top: 0.5rem; font-size: 0.88rem; color: #555; }
    .rationale summary { cursor: pointer; font-style: italic; }
    .effect-on-software {
      margin-top: 0.75rem;
      padding: 0.6rem 0.9rem;
      background: #f8f8f8;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-family: "Courier New", monospace;
      font-size: 0.82rem;
    }
    .effect-on-software ul { margin: 0; padding-left: 1.2rem; }
    .effect-on-software li { margin: 0.25rem 0; }
    .expires { color: #b45309; font-weight: bold; }
    @media print {
      body { margin: 1cm; }
      details { display: block; }
      details summary { display: none; }
    }
  </style>
</head>
<body>
  <h1>${esc(doc.title)}</h1>
  <div class="doc-meta">
    <span>${esc(typeLabel)}</span>
    ${adoptedDate ? `· Adopted ${esc(adoptedDate)}` : ""}
    ${expiresDate ? `· <span class="expires">Expires ${esc(expiresDate)}</span>` : ""}
    · Version ${doc.version ?? 1}
  </div>
  ${body}
</body>
</html>`;
}
