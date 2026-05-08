import { randomUUID } from "crypto";
import { CommunityDb } from "../CommunityDb.js";
import {
    type GoverningDocument,
    type DocumentArticle,
    type DocumentSection,
    type DocumentParameter,
    type DocumentAmendment,
} from "@ecf/core";

export class DocumentLoader {
    private get db() { return CommunityDb.getInstance().db; }

    // ── Persistence ───────────────────────────────────────────────────────────

    save(doc: GoverningDocument): void {
        this.db.prepare(`
            INSERT INTO bylaws (id, data) VALUES (?, ?)
            ON CONFLICT(id) DO UPDATE SET data = excluded.data
        `).run(doc.id, JSON.stringify(doc));
    }

    delete(id: string): void {
        const doc = this.load(id);
        if (doc?.readonly) throw new Error(`Document "${id}" is read-only and cannot be deleted.`);
        this.db.prepare(`DELETE FROM bylaws WHERE id = ?`).run(id);
    }

    load(id: string): GoverningDocument | null {
        const row = this.db.prepare(`SELECT data FROM bylaws WHERE id = ?`).get(id) as { data: string } | undefined;
        return row ? JSON.parse(row.data) as GoverningDocument : null;
    }

    /** Load all documents, with optional filters. */
    loadAll(opts?: { type?: string; excludeIds?: string[] }): GoverningDocument[] {
        const rows = this.db.prepare(`SELECT data FROM bylaws ORDER BY id`).all() as { data: string }[];
        let docs = rows.map(r => JSON.parse(r.data) as GoverningDocument);
        if (opts?.type)       docs = docs.filter(d => d.type === opts.type);
        if (opts?.excludeIds) docs = docs.filter(d => !opts.excludeIds!.includes(d.id));
        return docs;
    }

    // ── Create ────────────────────────────────────────────────────────────────

    create(
        title:       string,
        preamble?:   string,
        authorityId: string = "assembly",
        domainId:    string | null = null,
        sunsetYears?: number,
        voteRuleId:  string = "simple-majority",
    ): GoverningDocument {
        const expiresAt = (sunsetYears && sunsetYears > 0)
            ? new Date(Date.now() + sunsetYears * 365.25 * 24 * 3600 * 1000).toISOString()
            : null;
        const existing = this.loadAll({ type: "bylaw" });
        const nextNumber = existing.reduce((max, d) => Math.max(max, d.number ?? 0), 0) + 1;
        const doc: GoverningDocument = {
            id:          randomUUID(),
            type:        "bylaw",
            number:      nextNumber,
            title:       title.trim(),
            preamble:    preamble?.trim() || undefined,
            articles:    [],
            adoptedAt:   new Date().toISOString(),
            version:     1,
            authorityId,
            voteRuleId,
            domainId,
            expiresAt,
        };
        this.save(doc);
        return doc;
    }

    // ── Articles & sections ───────────────────────────────────────────────────

    addArticle(id: string, number: string, title: string, preamble?: string): GoverningDocument {
        const doc = this.requireWritable(id);
        if (doc.articles.some(a => a.number === number)) throw new Error(`Article ${number} already exists`);
        const article: DocumentArticle = {
            number,
            title:    title.trim(),
            preamble: preamble?.trim() || undefined,
            sections: [],
        };
        doc.articles.push(article);
        doc.articles.sort((a, b) => a.number.localeCompare(b.number));
        this.save(doc);
        return doc;
    }

    addSection(
        docId:         string,
        articleNumber: string,
        sectionId:     string,
        title:         string,
        body:          string,
        opts?: { rationale?: string; voteRuleId?: string | null },
    ): GoverningDocument {
        const doc     = this.requireWritable(docId);
        const article = doc.articles.find(a => a.number === articleNumber);
        if (!article) throw new Error(`Article ${articleNumber} not found`);
        if (article.sections.some(s => s.id === sectionId)) throw new Error(`Section ${sectionId} already exists`);
        const section: DocumentSection = {
            id:         sectionId,
            title:      title.trim() || undefined,
            body:       body.trim(),
            adoptedAt:  new Date().toISOString(),
            rationale:  opts?.rationale?.trim() || undefined,
            voteRuleId: opts?.voteRuleId ?? null,
        };
        article.sections.push(section);
        this.save(doc);
        return doc;
    }

    updateSection(docId: string, sectionId: string, body: string): GoverningDocument {
        const doc = this.requireWritable(docId);
        for (const article of doc.articles) {
            const section = article.sections.find(s => s.id === sectionId);
            if (section) {
                section.body = body.trim();
                this.save(doc);
                return doc;
            }
        }
        throw new Error(`Section ${sectionId} not found in document ${docId}`);
    }

    // ── Parameter system ──────────────────────────────────────────────────────

    /** Read a single parameter value. Throws if the document or parameter is not found. */
    getParam<T extends number | boolean>(docId: string, key: string): T {
        const doc = this.requireDoc(docId);
        const param = doc.parameters?.[key];
        if (!param) throw new Error(`Unknown parameter "${key}" in document "${docId}"`);
        return param.value as T;
    }

    /** Read all parameters from a document. Returns {} if the document has none. */
    getParams(docId: string): Record<string, DocumentParameter> {
        const doc = this.requireDoc(docId);
        return { ...(doc.parameters ?? {}) };
    }

    /**
     * Amend a parameter. Enforces immutability and constraints.
     * Records the amendment in doc.amendments and bumps version.
     */
    amend(docId: string, key: string, newValue: number | boolean, motionId: string): GoverningDocument {
        const doc   = this.requireWritable(docId);
        const param = doc.parameters?.[key];
        if (!param) throw new Error(`Unknown parameter "${key}" in document "${docId}"`);
        if (param.immutable) throw new Error(`Parameter "${key}" is immutable — it is a unit definition, not a policy choice.`);
        if (typeof newValue === "number" && param.constraints) {
            const { min, max } = param.constraints;
            if (min !== undefined && newValue < min)
                throw new Error(`Value ${newValue} is below the minimum (${min}) for "${key}"`);
            if (max !== undefined && newValue > max)
                throw new Error(`Value ${newValue} exceeds the maximum (${max}) for "${key}"`);
        }
        const amendment: DocumentAmendment = {
            version:   doc.version + 1,
            parameter: key,
            oldValue:  param.value,
            newValue,
            motionId,
            amendedAt: new Date().toISOString(),
        };
        (param as { value: number | boolean }).value = newValue;
        doc.version = amendment.version;
        if (!doc.amendments) doc.amendments = [];
        doc.amendments.push(amendment);
        this.save(doc);
        return doc;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private requireDoc(id: string): GoverningDocument {
        const doc = this.load(id);
        if (!doc) throw new Error(`Document "${id}" not found`);
        return doc;
    }

    private requireWritable(id: string): GoverningDocument {
        const doc = this.requireDoc(id);
        if (doc.readonly) throw new Error(`Document "${id}" is read-only`);
        return doc;
    }
}
