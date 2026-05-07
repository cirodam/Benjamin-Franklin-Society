import { FederationFunctionalDomain } from "./FederationFunctionalDomain.js";

/**
 * FederationDomainService is the registry for all federation-level functional domains.
 *
 * Domains are code-defined singletons registered at startup.
 * Unlike the community DomainService, there is no unit/role/pool sub-system —
 * each federation domain manages its own entity types directly.
 */
export class FederationDomainService {
    private static instance: FederationDomainService;
    private readonly domains = new Map<string, FederationFunctionalDomain>();

    private constructor() {}

    static getInstance(): FederationDomainService {
        if (!FederationDomainService.instance) FederationDomainService.instance = new FederationDomainService();
        return FederationDomainService.instance;
    }

    registerDomain(domain: FederationFunctionalDomain): void { this.domains.set(domain.id, domain); }
    getDomain(id: string): FederationFunctionalDomain | undefined { return this.domains.get(id); }
    getDomains(): FederationFunctionalDomain[] { return [...this.domains.values()]; }
}
