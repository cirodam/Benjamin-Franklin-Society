import { randomUUID } from "crypto";

/**
 * A LeaderPool is a named group of members who collectively govern
 * a FunctionalDomain. Pools are referenced by ID from FunctionalDomain.poolId.
 *
 * Membership is stored as a flat list of personIds. The service layer resolves
 * these to Person objects when needed.
 */
export class LeaderPool {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly createdAt: Date;

    mandate:   string = "";
    personIds: string[] = [];

    constructor(name: string, description: string = "", id?: string) {
        this.id = id ?? randomUUID();
        this.name = name;
        this.description = description;
        this.createdAt = new Date();
    }

    addPerson(personId: string): void {
        if (!this.personIds.includes(personId)) {
            this.personIds.push(personId);
        }
    }

    removePerson(personId: string): void {
        this.personIds = this.personIds.filter(id => id !== personId);
    }

    hasPerson(personId: string): boolean {
        return this.personIds.includes(personId);
    }
}
