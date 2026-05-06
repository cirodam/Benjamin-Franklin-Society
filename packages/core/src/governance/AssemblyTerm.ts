import { randomUUID } from "crypto";

// ── Seat ─────────────────────────────────────────────────────────────────────

/**
 * One seat in an assembly term.
 *
 * At community level: populated with `personId` + `personHandle` by sortition draw.
 * At federation level: populated with `communityId` + `communityHandle`; the
 * `personHandle` field holds the nominated delegate (null = seat is vacant).
 *
 * The only structural difference between levels is *where members come from*,
 * not what a seat is.
 */
export interface AssemblyMember {
    seatedAt:         string | null;   // null = vacant
    personHandle:     string | null;   // the person occupying the seat; null = vacant
    personName?:      string | null;   // display name (optional)
    personId?:        string;          // local person record ID (community-level)
    communityId?:     string;          // which community this seat represents (federation-level)
    communityHandle?: string;          // community handle (federation-level)
}

// ── Data shape ────────────────────────────────────────────────────────────────

export interface AssemblyTermData {
    id:         string;
    termNumber: number;
    startedAt:  string;
    endsAt:     string | null;
    seats:      AssemblyMember[];
    motionIds:  string[];
}

// ── Class ─────────────────────────────────────────────────────────────────────

export class AssemblyTerm {
    readonly id:         string;
    readonly termNumber: number;
    readonly startedAt:  string;
    endsAt:    string | null;
    seats:     AssemblyMember[];
    motionIds: string[];

    constructor(opts: {
        termNumber: number;
        id?:        string;
        startedAt?: string;
        endsAt?:    string | null;
        seats?:     AssemblyMember[];
        motionIds?: string[];
    }) {
        this.id         = opts.id        ?? randomUUID();
        this.termNumber = opts.termNumber;
        this.startedAt  = opts.startedAt ?? new Date().toISOString();
        this.endsAt     = opts.endsAt    ?? null;
        this.seats      = opts.seats     ?? [];
        this.motionIds  = opts.motionIds ?? [];
    }

    get seatedMembers(): AssemblyMember[] {
        return this.seats.filter(s => s.seatedAt !== null);
    }

    get vacantSeats(): AssemblyMember[] {
        return this.seats.filter(s => s.seatedAt === null);
    }

    toData(): AssemblyTermData {
        return {
            id:         this.id,
            termNumber: this.termNumber,
            startedAt:  this.startedAt,
            endsAt:     this.endsAt,
            seats:      this.seats,
            motionIds:  this.motionIds,
        };
    }

    static fromData(d: AssemblyTermData): AssemblyTerm {
        return new AssemblyTerm({
            id:         d.id,
            termNumber: d.termNumber,
            startedAt:  d.startedAt,
            endsAt:     d.endsAt,
            seats:      d.seats    ?? [],
            motionIds:  d.motionIds ?? [],
        });
    }
}

