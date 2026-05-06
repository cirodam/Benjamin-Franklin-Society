import { CommunityDb } from "../CommunityDb.js";
import { type GoverningDocument, extractParamKeys } from "../common/DocumentFramework.js";
import {
    type ConstitutionMetadata,
    type ConstitutionalParameter,
    type ConstitutionAmendment,
    type ActionAuthority,
    type GovernanceBody,
    VoteThreshold,
    DEFAULT_ARTICLES,
    DEFAULT_CONSTITUTION_META,
} from "./Constitution.js";

const DOC_ID   = "constitution";
const META_KEY = "constitution_meta";

export class ConstitutionLoader {
    private static _instance: ConstitutionLoader;

    private _doc:  GoverningDocument = defaultDoc();
    private _meta: ConstitutionMetadata = { ...DEFAULT_CONSTITUTION_META, documentId: DOC_ID, amendments: [] };

    private get db() { return CommunityDb.getInstance().db; }

    static getInstance(): ConstitutionLoader {
        if (!ConstitutionLoader._instance) ConstitutionLoader._instance = new ConstitutionLoader();
        return ConstitutionLoader._instance;
    }

    /**
     * Load persisted data from the DB.
     * Automatically migrates from the legacy singleton_records["constitution"] format
     * (where everything was stored as one ConstitutionDocument JSON blob).
     * Seeds defaults on first boot.
     */
    load(): void {
        // ── Migration: old format stored everything in singleton_records["constitution"] ──
        const oldRow = this.db.prepare("SELECT data FROM singleton_records WHERE key = ?").get(DOC_ID) as { data: string } | undefined;
        if (oldRow) {
            const old = JSON.parse(oldRow.data) as Record<string, unknown>;
            if (Array.isArray(old.articles)) {
                // It's the old ConstitutionDocument format — migrate it
                const arts = old.articles as typeof DEFAULT_ARTICLES;
                this._doc.articles  = arts.length ? arts : DEFAULT_ARTICLES;
                if (typeof old.adoptedAt === "string") this._doc.adoptedAt = old.adoptedAt;
                this._meta.version         = typeof old.version === "number" ? old.version : 1;
                this._meta.communityName   = typeof old.communityName === "string" ? old.communityName : "My Community";
                this._meta.communityHandle = typeof old.communityHandle === "string" ? old.communityHandle : "";
                if (old.parameters && typeof old.parameters === "object")
                    this._meta.parameters = { ...DEFAULT_CONSTITUTION_META.parameters, ...(old.parameters as typeof DEFAULT_CONSTITUTION_META.parameters) };
                if (Array.isArray(old.amendments))
                    this._meta.amendments = old.amendments as ConstitutionAmendment[];
                if (Array.isArray(old.authorityMap) && (old.authorityMap as unknown[]).length)
                    this._meta.authorityMap = old.authorityMap as ActionAuthority[];
                this.save();
                this.db.prepare("DELETE FROM singleton_records WHERE key = ?").run(DOC_ID);
                return;
            }
        }

        // ── Normal load ──────────────────────────────────────────────────────────────
        const docRow = this.db.prepare("SELECT data FROM bylaws WHERE id = ?").get(DOC_ID) as { data: string } | undefined;
        if (docRow) this._doc = JSON.parse(docRow.data) as GoverningDocument;

        const metaRow = this.db.prepare("SELECT data FROM singleton_records WHERE key = ?").get(META_KEY) as { data: string } | undefined;
        if (metaRow) {
            const saved = JSON.parse(metaRow.data) as Partial<ConstitutionMetadata>;
            this._meta = {
                ...DEFAULT_CONSTITUTION_META,
                ...saved,
                // Merge so new default params are picked up after code upgrades
                parameters: { ...DEFAULT_CONSTITUTION_META.parameters, ...saved.parameters },
                documentId: DOC_ID,
            };
        }

        // First boot — nothing in DB, seed defaults
        if (!docRow && !metaRow) this.save();
    }

    save(): void {
        this.db.prepare(
            "INSERT INTO bylaws (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data",
        ).run(DOC_ID, JSON.stringify(this._doc));
        this.db.prepare(
            "INSERT INTO singleton_records (key, data) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data",
        ).run(META_KEY, JSON.stringify(this._meta));
    }

    // ── Document (articles) ──────────────────────────────────────────────────

    getDoc(): GoverningDocument { return this._doc; }
    getMeta(): ConstitutionMetadata { return this._meta; }

    updateSection(sectionId: string, body: string): void {
        for (const article of this._doc.articles) {
            const section = article.sections.find(s => s.id === sectionId);
            if (section) {
                section.body = body.trim();
                section.paramKeys = extractParamKeys(body);
                return;
            }
        }
        throw new Error(`Section "${sectionId}" not found`);
    }

    // ── Identity ─────────────────────────────────────────────────────────────

    get version(): number         { return this._meta.version; }
    get adoptedAt(): string       { return this._doc.adoptedAt; }
    get communityName(): string   { return this._meta.communityName; }
    get communityHandle(): string { return this._meta.communityHandle; }

    setCommunityName(name: string): void { this._meta.communityName = name; }

    setCommunityHandle(handle: string): void {
        const h = handle.toLowerCase().trim().replace(/_/g, "-");
        if (!/^[a-z0-9][a-z0-9-]{0,30}[a-z0-9]$|^[a-z0-9]{1,2}$/.test(h)) {
            throw new Error(
                `Invalid community handle "${handle}". Use 2–32 characters: lowercase letters, digits, hyphens (no leading/trailing hyphens).`,
            );
        }
        this._meta.communityHandle = h;
    }

    // ── Parameters ───────────────────────────────────────────────────────────

    get amendments(): readonly ConstitutionAmendment[] { return this._meta.amendments; }

    get<T extends number | boolean>(key: string): T {
        const param = this._meta.parameters[key];
        if (!param) throw new Error(`Unknown constitutional parameter: "${key}"`);
        return param.value as T;
    }

    getParameter(key: string): ConstitutionalParameter<number | boolean> {
        const param = this._meta.parameters[key];
        if (!param) throw new Error(`Unknown constitutional parameter: "${key}"`);
        return param;
    }

    getAll(): Record<string, ConstitutionalParameter<number | boolean>> {
        return { ...this._meta.parameters };
    }

    amend(key: string, newValue: number | boolean, proposalId: string): void {
        const param = this._meta.parameters[key];
        if (!param) throw new Error(`Unknown constitutional parameter: "${key}"`);
        if (param.immutable) {
            throw new Error(`Parameter "${key}" is immutable — it is a unit definition, not a policy choice.`);
        }
        if (typeof newValue === "number" && param.constraints) {
            const { min, max } = param.constraints;
            if (min !== undefined && newValue < min)
                throw new Error(`Value ${newValue} is below the minimum (${min}) for "${key}"`);
            if (max !== undefined && newValue > max)
                throw new Error(`Value ${newValue} exceeds the maximum (${max}) for "${key}"`);
        }
        const amendment: ConstitutionAmendment = {
            version:   this._meta.version + 1,
            parameter: key,
            oldValue:  param.value,
            newValue,
            proposalId,
            amendedAt: new Date().toISOString(),
        };
        (this._meta.parameters[key] as { value: number | boolean }).value = newValue;
        this._meta.version = amendment.version;
        this._meta.amendments.push(amendment);
    }

    // ── Convenience parameter getters ────────────────────────────────────────

    get thresholds(): Record<VoteThreshold, number> {
        return {
            [VoteThreshold.SIMPLE_MAJORITY]: this.get<number>("thresholdSimpleMajority"),
            [VoteThreshold.SUPERMAJORITY]:   this.get<number>("thresholdSupermajority"),
            [VoteThreshold.NEAR_CONSENSUS]:  this.get<number>("thresholdNearConsensus"),
        };
    }

    get deliberationPeriodDays(): number          { return this.get<number>("deliberationPeriodDays"); }
    get assemblyFraction(): number                { return this.get<number>("assemblyFraction"); }
    get assemblyTermMonths(): number              { return this.get<number>("assemblyTermMonths"); }
    get assemblyTermStartMonth(): number          { return this.get<number>("assemblyTermStartMonth"); }
    get assemblyTermStartDay(): number            { return this.get<number>("assemblyTermStartDay"); }
    get bankDemurrageRate(): number               { return this.get<number>("bankDemurrageRate"); }
    get demurrageFloor(): number                  { return this.get<number>("demurrageFloor"); }
    get kinPerPersonYear(): number                { return this.get<number>("kinPerPersonYear"); }
    get workingAgeMin(): number                   { return this.get<number>("workingAgeMin"); }
    get retirementAge(): number                   { return this.get<number>("retirementAge"); }
    get retirementPayoutRate(): number            { return this.get<number>("retirementPayoutRate"); }
    get birthdayCirculationFraction(): number     { return this.get<number>("birthdayCirculationFraction"); }
    get communityDuesRate(): number               { return this.get<number>("communityDuesRate"); }
    get endowmentPoolFraction(): number           { return this.get<number>("endowmentPoolFraction"); }
    get memberAdmissionVouchesRequired(): number  { return this.get<number>("memberAdmissionVouchesRequired"); }
    get stewardshipThresholdYears(): number       { return this.get<number>("stewardshipThresholdYears"); }

    // ── Term window ──────────────────────────────────────────────────────────

    currentTermWindow(today: Date = new Date()): { start: Date; end: Date } {
        const month  = this.assemblyTermStartMonth;
        const day    = this.assemblyTermStartDay;
        const months = this.assemblyTermMonths;
        let anchor = new Date(today.getFullYear(), month - 1, day);
        if (anchor > today) anchor = new Date(today.getFullYear() - 1, month - 1, day);
        const end = new Date(anchor);
        end.setMonth(end.getMonth() + months);
        return { start: anchor, end };
    }

    nextTermStartDate(today: Date = new Date()): string {
        const month = this.assemblyTermStartMonth;
        const day   = this.assemblyTermStartDay;
        let anchor  = new Date(today.getFullYear(), month - 1, day);
        if (anchor < today) anchor = new Date(today.getFullYear() + 1, month - 1, day);
        return anchor.toISOString().slice(0, 10);
    }

    // ── Authority map ────────────────────────────────────────────────────────

    getRequiredBody(action: string): GovernanceBody | null {
        return this._meta.authorityMap.find(a => a.action === action)?.body ?? null;
    }

    getRequiredVoteRule(action: string): string | null {
        return this._meta.authorityMap.find(a => a.action === action)?.voteRuleId ?? null;
    }

    get authorityMap(): readonly ActionAuthority[] { return this._meta.authorityMap; }
}

function defaultDoc(): GoverningDocument {
    return {
        id:          DOC_ID,
        type:        "constitution",
        title:       "Community Constitution",
        articles:    DEFAULT_ARTICLES,
        adoptedAt:   new Date().toISOString(),
        version:     1,
        authorityId: "community",
        voteRuleId:  "referendum-constitutional",
    };
}

