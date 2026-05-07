import type { GoverningDocument } from "@ecf/core";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "data");

/**
 * A document template — a GoverningDocument without the runtime-computed date
 * fields. Use importTemplate() to stamp in dates and produce a full document.
 *
 * For ordinances that carry a sunset, set `renewalYears` and importTemplate()
 * will compute expiresAt = adoptedAt + renewalYears.
 */
export type DocumentTemplate = Omit<GoverningDocument, "adoptedAt" | "expiresAt"> & {
    renewalYears?: number;
};

/**
 * Load a DocumentTemplate from a JSON file in the bundled data directory.
 * The name should match the document id (e.g. "constitution", "healthcare").
 */
export function loadTemplate(name: string): DocumentTemplate {
    const json = readFileSync(join(DATA_DIR, `${name}.json`), "utf-8");
    return JSON.parse(json) as DocumentTemplate;
}

/**
 * Convert a DocumentTemplate into a full GoverningDocument, setting adoptedAt
 * to the current time and computing expiresAt from renewalYears (if present).
 */
export function importTemplate(template: DocumentTemplate): GoverningDocument {
    const { renewalYears, ...rest } = template;
    const adoptedAt = new Date();
    let expiresAt: string | null = null;
    if (renewalYears) {
        const d = new Date(adoptedAt);
        d.setFullYear(d.getFullYear() + renewalYears);
        expiresAt = d.toISOString();
    }
    return { ...rest, adoptedAt: adoptedAt.toISOString(), expiresAt };
}

/**
 * Deserialize a GoverningDocument from a JSON string (e.g. a file read from
 * disk or received over the network). The caller is responsible for validating
 * the result before saving it to the database.
 */
export function importDocument(json: string): GoverningDocument {
    return JSON.parse(json) as GoverningDocument;
}

/**
 * Serialize a GoverningDocument to a pretty-printed JSON string suitable for
 * storage or transfer to another community instance.
 */
export function exportDocument(doc: GoverningDocument): string {
    return JSON.stringify(doc, null, 2);
}
