import { PersonService } from "../person/PersonService.js";
import { DomainService } from "../DomainService.js";
import { AuthorityLoader } from "./AuthorityLoader.js";
import { Authority, Assembly, Committee, LeaderPool } from "@ecf/core";

export class AuthorityService {
    private static instance: AuthorityService;

    static getInstance(): AuthorityService {
        if (!AuthorityService.instance) AuthorityService.instance = new AuthorityService();
        return AuthorityService.instance;
    }

    /** All authorities: virtual membership + referendum + stored authorities + leadership pools. */
    getAll(): Authority[] {
        return [
            new Authority("membership", "Full Membership",  "absolute-majority",      "All active members — asynchronous online referendum.", "membership"),
            new Authority("referendum", "Referendum",        "absolute-supermajority", "A direct vote of all active members, used for constitutional decisions.", "referendum"),
            ...AuthorityLoader.getInstance().loadAll(),
            ...DomainService.getInstance().getPools(),
        ];
    }

    get(id: string): Authority | undefined {
        if (id === "membership" || id === "referendum") {
            return this.getAll().find(a => a.id === id);
        }
        return AuthorityLoader.getInstance().load(id)
            ?? DomainService.getInstance().getPool(id);
    }

    /**
     * Resolve the set of person IDs eligible to vote under the given authority.
     * Returns an empty array if the authority is unknown.
     */
    getMemberIds(authorityId: string): string[] {
        const authority = this.get(authorityId);
        if (authority instanceof Assembly)   return authority.memberIds;
        if (authority instanceof Committee)  return authority.memberIds;
        if (authority instanceof LeaderPool) return authority.personIds;
        if (authorityId === "membership" || authorityId === "referendum") {
            return PersonService.getInstance().getAll()
                .filter(p => !p.disabled)
                .map(p => p.id);
        }
        return [];
    }

    isMember(authorityId: string, personId: string): boolean {
        return this.getMemberIds(authorityId).includes(personId);
    }
}
