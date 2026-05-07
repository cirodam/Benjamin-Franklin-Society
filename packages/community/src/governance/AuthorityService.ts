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

    /** All authorities: stored (reconciler-created) authorities + leadership pools. */
    getAll(): Authority[] {
        return [
            ...AuthorityLoader.getInstance().loadAll(),
            ...DomainService.getInstance().getPools(),
        ];
    }

    get(id: string): Authority | undefined {
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
        if (authorityId === "referendum") {
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
