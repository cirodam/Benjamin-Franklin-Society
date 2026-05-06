import { randomUUID } from "crypto";
import { CommunityDb } from "../CommunityDb.js";
import { type GoverningDocument, type DocumentArticle, type DocumentSection, extractParamKeys } from "../common/DocumentFramework.js";

export class DocumentLoader {
    private get db() { return CommunityDb.getInstance().db; }

    save(bylaw: GoverningDocument): void {
        this.db.prepare(`
            INSERT INTO bylaws (id, data) VALUES (?, ?)
            ON CONFLICT(id) DO UPDATE SET data = excluded.data
        `).run(bylaw.id, JSON.stringify(bylaw));
    }

    delete(id: string): void {
        this.db.prepare(`DELETE FROM bylaws WHERE id = ?`).run(id);
    }

    load(id: string): GoverningDocument | null {
        const row = this.db.prepare(`SELECT data FROM bylaws WHERE id = ?`).get(id) as { data: string } | undefined;
        return row ? JSON.parse(row.data) as GoverningDocument : null;
    }

    loadAll(): GoverningDocument[] {
        const rows = this.db.prepare(`SELECT data FROM bylaws WHERE id NOT IN ('constitution', 'charter') ORDER BY id`).all() as { data: string }[];
        return rows.map(r => JSON.parse(r.data) as GoverningDocument);
    }

    create(title: string, preamble?: string, authorityId: string = "assembly", domainId: string | null = null, sunsetYears?: number, voteRuleId: string = "assembly-general"): GoverningDocument {
        const expiresAt = (sunsetYears && sunsetYears > 0)
            ? new Date(Date.now() + sunsetYears * 365.25 * 24 * 3600 * 1000).toISOString()
            : null;
        const bylaw: GoverningDocument = {
            id:          randomUUID(),
            type:        "bylaw",
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
        this.save(bylaw);
        return bylaw;
    }

    addArticle(id: string, number: string, title: string, preamble?: string): GoverningDocument {
        const bylaw = this.load(id);
        if (!bylaw) throw new Error(`Bylaw ${id} not found`);
        if (bylaw.articles.some(a => a.number === number)) throw new Error(`Article ${number} already exists`);
        const article: DocumentArticle = {
            number,
            title:    title.trim(),
            preamble: preamble?.trim() || undefined,
            sections: [],
        };
        bylaw.articles.push(article);
        bylaw.articles.sort((a, b) => a.number.localeCompare(b.number));
        this.save(bylaw);
        return bylaw;
    }

    addSection(bylawId: string, articleNumber: string, sectionId: string, title: string, body: string, opts?: { rationale?: string; sunsetAt?: string | null; voteRuleId?: string | null }): GoverningDocument {
        const bylaw = this.load(bylawId);
        if (!bylaw) throw new Error(`Bylaw ${bylawId} not found`);
        const article = bylaw.articles.find(a => a.number === articleNumber);
        if (!article) throw new Error(`Article ${articleNumber} not found`);
        if (article.sections.some(s => s.id === sectionId)) throw new Error(`Section ${sectionId} already exists`);
        const section: DocumentSection = {
            id:             sectionId,
            title:          title.trim() || undefined,
            body:           body.trim(),
            paramKeys:      extractParamKeys(body),
            adoptedAt:      new Date().toISOString(),
            rationale:      opts?.rationale?.trim() || undefined,
            sunsetAt:       opts?.sunsetAt ?? null,
            voteRuleId:     opts?.voteRuleId ?? null,
        };
        article.sections.push(section);
        this.save(bylaw);
        return bylaw;
    }

    updateSection(bylawId: string, sectionId: string, body: string): GoverningDocument {
        const bylaw = this.load(bylawId);
        if (!bylaw) throw new Error(`Bylaw ${bylawId} not found`);
        for (const article of bylaw.articles) {
            const section = article.sections.find(s => s.id === sectionId);
            if (section) {
                section.body      = body.trim();
                section.paramKeys = extractParamKeys(body);
                this.save(bylaw);
                return bylaw;
            }
        }
        throw new Error(`Section ${sectionId} not found in bylaw ${bylawId}`);
    }
}
