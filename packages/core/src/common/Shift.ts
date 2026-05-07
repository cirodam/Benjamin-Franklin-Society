import { randomUUID } from "crypto";

export class Shift {

    readonly id:        string;
    readonly createdAt: string;
    readonly createdBy: string;   // personId

    domainId:         string;
    label:            string;
    startAt:          string;     // ISO 8601
    endAt:            string;     // ISO 8601
    assignedPersonId: string | null;
    note:             string | null;

    constructor(
        domainId:  string,
        label:     string,
        startAt:   string,
        endAt:     string,
        createdBy: string,
        note:      string | null = null,
    ) {
        this.id               = randomUUID();
        this.createdAt        = new Date().toISOString();
        this.createdBy        = createdBy;
        this.domainId         = domainId;
        this.label            = label.trim();
        this.startAt          = startAt;
        this.endAt            = endAt;
        this.assignedPersonId = null;
        this.note             = note;
    }

    get isOpen(): boolean { return this.assignedPersonId === null; }

    static restore(r: {
        id:               string;
        createdAt:        string;
        createdBy:        string;
        domainId:         string;
        label:            string;
        startAt:          string;
        endAt:            string;
        assignedPersonId: string | null;
        note:             string | null;
    }): Shift {
        const s = Object.create(Shift.prototype) as Shift;
        Object.assign(s, r);
        return s;
    }
}
