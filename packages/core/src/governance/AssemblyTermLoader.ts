import { BaseLoader } from "../storage/BaseLoader.js";
import { AssemblyTerm, type AssemblyTermData } from "./AssemblyTerm.js";

/**
 * Concrete file-based loader for AssemblyTerm records.
 * Used directly by the federation (flat-file storage).
 * The community package extends this with an SQLite override.
 */
export class AssemblyTermLoader extends BaseLoader<AssemblyTermData, AssemblyTerm> {
    protected serialize(term: AssemblyTerm): AssemblyTermData { return term.toData(); }
    protected deserialize(d: AssemblyTermData): AssemblyTerm  { return AssemblyTerm.fromData(d); }

    override loadAll(): AssemblyTerm[] {
        return super.loadAll().sort((a, b) => b.termNumber - a.termNumber);
    }

    /** Returns the term with the highest termNumber, or undefined if none exist. */
    loadLatest(): AssemblyTerm | undefined {
        return this.loadAll()[0];
    }
}
