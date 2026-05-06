import { randomUUID } from "crypto";
import { Authority } from "./Authority.js";

/**
 * A LeaderPool is a named group of members who collectively govern
 * a FunctionalDomain. Pools are referenced by ID from FunctionalDomain.poolId.
 *
 * Membership is stored as a flat list of personIds. The service layer resolves
 * these to Person objects when needed.
 *
 * LeaderPool extends Authority so it can be used directly as an authority
 * without a separate companion record.
 */
export class LeaderPool extends Authority {
    readonly kind = "pool" as const;
    readonly createdAt: Date;

    mandate:   string   = "";
    personIds: string[] = [];

    constructor(
        id:                string = randomUUID(),
        name:              string,
        defaultVoteRuleId  = "simple-majority",
        description        = "",
    ) {
        super(id, name, defaultVoteRuleId, description);
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
