import logger from "./logger.js";
import { FunctionalDomain, type BudgetItem } from "./common/domain/FunctionalDomain.js";
import { FunctionalUnit } from "./common/domain/FunctionalUnit.js";
import { FunctionalDomainLoader } from "./common/domain/FunctionalDomainLoader.js";
import { FunctionalUnitLoader } from "./common/domain/FunctionalUnitLoader.js";
import { CommunityRole } from "./common/CommunityRole.js";
import { CommunityRoleLoader } from "./common/domain/CommunityRoleLoader.js";
import { RoleType } from "./common/RoleType.js";
import { RoleTypeLoader } from "./common/RoleTypeLoader.js";
import { UnitType } from "./common/domain/UnitType.js";
import { UnitTypeLoader } from "./common/domain/UnitTypeLoader.js";
import { UnitTemplateRegistry } from "./common/domain/UnitTemplateRegistry.js";
import { LeaderPool } from "@ecf/core";
import { LeaderPoolLoader } from "./governance/LeaderPoolLoader.js";
import { BankClient } from "@ecf/core";
import { PersonService } from "./person/PersonService.js";

/**
 * DomainService is the single source of truth for the community's operational structure.
 * It holds flat registries of domains, units, roles, and pools and owns all payroll logic.
 *
 * Domains are code-defined singletons — they must be registered via registerDomain()
 * during startup, after which their persisted state is restored from FunctionalDomainLoader.
 */
export class DomainService {
    private static instance: DomainService;

    private domains: Map<string, FunctionalDomain> = new Map();
    private units:     Map<string, FunctionalUnit>   = new Map();
    private roles:     Map<string, CommunityRole>    = new Map();
    private roleTypes: Map<string, RoleType>         = new Map();
    private unitTypes: Map<string, UnitType>         = new Map();
    private pools:     Map<string, LeaderPool>       = new Map();

    private domainLoader:    FunctionalDomainLoader | null = null;
    private unitLoader:      FunctionalUnitLoader   | null = null;
    private roleLoader:      CommunityRoleLoader    | null = null;
    private roleTypeLoader:  RoleTypeLoader         | null = null;
    private unitTypeLoader:  UnitTypeLoader         | null = null;
    private poolLoader:      LeaderPoolLoader       | null = null;

    private initialized = false;

    private constructor() {}

    private assertInit(): void {
        if (!this.initialized) throw new Error("DomainService.init() must be called before write operations");
    }

    static getInstance(): DomainService {
        if (!DomainService.instance) DomainService.instance = new DomainService();
        return DomainService.instance;
    }

    // ── Startup ───────────────────────────────────────────────────────────────

    init(
        domainLoader: FunctionalDomainLoader,
        unitLoader:   FunctionalUnitLoader,
        roleLoader:   CommunityRoleLoader,
        poolLoader:   LeaderPoolLoader,
    ): void {
        this.domainLoader = domainLoader;
        this.unitLoader   = unitLoader;
        this.roleLoader   = roleLoader;
        this.poolLoader   = poolLoader;

        for (const unit of unitLoader.loadAll())   this.units.set(unit.id, unit);
        for (const role of roleLoader.loadAll())   this.roles.set(role.id, role);
        for (const pool of poolLoader.loadAll())   this.pools.set(pool.id, pool);
        this.initialized = true;
    }

    initRoleTypes(loader: RoleTypeLoader): void {
        this.roleTypeLoader = loader;
        for (const rt of loader.loadAll()) this.roleTypes.set(rt.id, rt);
        logger.info(`[DomainService] loaded ${this.roleTypes.size} role type(s)`);
    }

    /**
     * Register a code-defined domain singleton and restore its persisted state.
     * Call once per domain during startup, after init().
     */
    registerDomain(domain: FunctionalDomain): void {
        this.domainLoader?.restore(domain);
        this.domains.set(domain.id, domain);
    }

    /** Persist an already-registered domain's current in-memory state to disk. */
    saveDomain(domain: FunctionalDomain): void {
        this.domainLoader?.save(domain);
    }

    // ── Domains ───────────────────────────────────────────────────────────────

    getDomain(id: string): FunctionalDomain | undefined { return this.domains.get(id); }
    getDomains(): FunctionalDomain[] { return Array.from(this.domains.values()); }

    // ── Units ─────────────────────────────────────────────────────────────────

    getUnit(id: string): FunctionalUnit | undefined { return this.units.get(id); }
    getUnits(): FunctionalUnit[] { return Array.from(this.units.values()); }

    getUnitsForDomain(domainId: string): FunctionalUnit[] {
        const domain = this.domains.get(domainId);
        if (!domain) return [];
        return domain.unitIds.flatMap(id => {
            const u = this.units.get(id);
            return u ? [u] : [];
        });
    }

    createUnit(unit: FunctionalUnit, domainId: string): void {
        this.assertInit();
        this.units.set(unit.id, unit);
        this.unitLoader?.save(unit);
        const domain = this.domains.get(domainId);
        if (domain) {
            domain.unitIds.push(unit.id);
            this.domainLoader?.save(domain);
        }
    }

    saveUnit(unit: FunctionalUnit): void {
        this.unitLoader?.save(unit);
    }

    deleteUnit(id: string): boolean {
        this.assertInit();
        const unit = this.units.get(id);
        if (!unit) return false;
        this.units.delete(id);
        this.unitLoader?.delete(id);
        for (const domain of this.domains.values()) {
            const idx = domain.unitIds.indexOf(id);
            if (idx !== -1) {
                domain.unitIds.splice(idx, 1);
                this.domainLoader?.save(domain);
            }
        }
        return true;
    }

    // ── Roles (unit slots) ────────────────────────────────────────────────────

    getRole(id: string): CommunityRole | undefined { return this.roles.get(id); }
    getRoles(): CommunityRole[] { return Array.from(this.roles.values()); }

    getRolesForUnit(unitId: string): CommunityRole[] {
        const unit = this.units.get(unitId);
        if (!unit) return [];
        return unit.roleIds.flatMap(id => {
            const r = this.roles.get(id);
            return r ? [r] : [];
        });
    }

    createRole(role: CommunityRole, unitId: string): void {
        this.assertInit();
        this.roles.set(role.id, role);
        this.roleLoader?.save(role);
        const unit = this.units.get(unitId);
        if (unit) {
            unit.roleIds.push(role.id);
            this.unitLoader?.save(unit);
        }
    }

    saveRole(role: CommunityRole): void {
        this.roleLoader?.save(role);
    }

    deleteRole(id: string): boolean {
        this.assertInit();
        if (!this.roles.has(id)) return false;
        this.roles.delete(id);
        this.roleLoader?.delete(id);
        for (const unit of this.units.values()) {
            const idx = unit.roleIds.indexOf(id);
            if (idx !== -1) {
                unit.roleIds.splice(idx, 1);
                this.unitLoader?.save(unit);
            }
        }
        return true;
    }

    // ── Role Types (the bank) ─────────────────────────────────────────────────

    getRoleType(id: string): RoleType | undefined { return this.roleTypes.get(id); }
    getRoleTypes(): RoleType[] { return Array.from(this.roleTypes.values()); }

    /** Returns true if the bank already contains a type with this exact title (case-insensitive). */
    hasRoleTypeWithTitle(title: string): boolean {
        const lower = title.toLowerCase();
        return [...this.roleTypes.values()].some(rt => rt.title.toLowerCase() === lower);
    }

    createRoleType(roleType: RoleType): void {
        this.assertInit();
        this.roleTypes.set(roleType.id, roleType);
        this.roleTypeLoader?.save(roleType);
    }

    saveRoleType(roleType: RoleType): void {
        this.roleTypeLoader?.save(roleType);
    }

    deleteRoleType(id: string): boolean {
        this.assertInit();
        if (!this.roleTypes.has(id)) return false;
        this.roleTypes.delete(id);
        this.roleTypeLoader?.delete(id);
        return true;
    }

    // ── Unit Types (the bank) ─────────────────────────────────────────────────

    initUnitTypes(loader: UnitTypeLoader): void {
        this.unitTypeLoader = loader;
        for (const ut of loader.loadAll()) {
            this.unitTypes.set(ut.type, ut);
            UnitTemplateRegistry.register({
                type:        ut.type,
                label:       ut.label,
                description: ut.description,
                factory:     () => new FunctionalUnit(ut.label, ut.description, ut.type),
            });
        }
        logger.info(`[DomainService] loaded ${this.unitTypes.size} custom unit type(s)`);
    }

    getUnitType(type: string): UnitType | undefined { return this.unitTypes.get(type); }
    getUnitTypes(): UnitType[] { return Array.from(this.unitTypes.values()); }

    /** True if the type exists either as a DB-persisted custom type or a built-in template. */
    hasUnitTypeWithType(type: string): boolean {
        return this.unitTypes.has(type) || !!UnitTemplateRegistry.get(type);
    }

    createUnitType(ut: UnitType): void {
        this.assertInit();
        this.unitTypes.set(ut.type, ut);
        this.unitTypeLoader?.save(ut);
        UnitTemplateRegistry.register({
            type:        ut.type,
            label:       ut.label,
            description: ut.description,
            factory:     () => new FunctionalUnit(ut.label, ut.description, ut.type),
        });
    }

    deleteUnitType(type: string): boolean {
        this.assertInit();
        const ut = this.unitTypes.get(type);
        if (!ut) return false;
        this.unitTypes.delete(type);
        this.unitTypeLoader?.deleteById(ut.id);
        return true;
    }

    // ── Budget ────────────────────────────────────────────────────────────────

    /**
     * Compute the full budget for a domain:
     * - payroll: derived from all role slots across all units in the domain
     * - items: the domain's manually-added line items (supplies, equipment, etc.)
     */
    getDomainBudget(domainId: string): {
        payroll: { roleId: string; title: string; memberId: string; kinPerMonth: number }[];
        items: BudgetItem[];
        totals: { payroll: number; items: number; total: number };
    } | null {
        const domain = this.domains.get(domainId);
        if (!domain) return null;

        const payroll = domain.unitIds.flatMap(unitId => {
            const unit = this.units.get(unitId);
            if (!unit) return [];
            return unit.roleIds.flatMap(roleId => {
                const role = this.roles.get(roleId);
                if (!role || !role.memberId) return [];
                return [{ roleId: role.id, title: role.title, memberId: role.memberId, kinPerMonth: role.kinPerMonth }];
            });
        });

        const memberCount = (() => {
            try { return PersonService.getInstance().count(); } catch { return 0; }
        })();
        const items = domain.budgetItems.map(i =>
            i.perMember ? { ...i, amount: i.amount * memberCount } : i,
        );
        const payrollTotal = payroll.reduce((sum, r) => sum + r.kinPerMonth, 0);
        const itemsTotal   = items.reduce((sum, i) => sum + i.amount, 0);

        return {
            payroll,
            items,
            totals: { payroll: payrollTotal, items: itemsTotal, total: payrollTotal + itemsTotal },
        };
    }

    addBudgetItem(domainId: string, item: Omit<BudgetItem, "id">): BudgetItem | null {
        this.assertInit();
        const domain = this.domains.get(domainId);
        if (!domain) return null;
        const newItem: BudgetItem = { id: crypto.randomUUID(), ...item };
        domain.budgetItems.push(newItem);
        this.domainLoader?.save(domain);
        return newItem;
    }

    updateBudgetItem(domainId: string, itemId: string, patch: Partial<Omit<BudgetItem, "id">>): BudgetItem | null {
        this.assertInit();
        const domain = this.domains.get(domainId);
        if (!domain) return null;
        const item = domain.budgetItems.find(i => i.id === itemId);
        if (!item) return null;
        if (patch.label    !== undefined) item.label    = patch.label;
        if (patch.amount   !== undefined) item.amount   = patch.amount;
        if (patch.category !== undefined) item.category = patch.category;
        if (patch.note     !== undefined) item.note     = patch.note;
        if (patch.perMember !== undefined) item.perMember = patch.perMember;
        this.domainLoader?.save(domain);
        return item;
    }

    removeBudgetItem(domainId: string, itemId: string): boolean {
        this.assertInit();
        const domain = this.domains.get(domainId);
        if (!domain) return false;
        const idx = domain.budgetItems.findIndex(i => i.id === itemId);
        if (idx === -1) return false;
        domain.budgetItems.splice(idx, 1);
        this.domainLoader?.save(domain);
        return true;
    }

    /**
     * Aggregate the budgets of every registered domain into a community-wide view.
     * Suitable for the public /api/budget endpoint.
     */
    getCommunityBudget(): {
        domains: Array<{
            domainId:   string;
            domainName: string;
            payroll:    { roleId: string; title: string; memberId: string; kinPerMonth: number }[];
            items:      BudgetItem[];
            totals:     { payroll: number; items: number; total: number };
        }>;
        totals: { payroll: number; items: number; total: number };
    } {
        let totalPayroll = 0;
        let totalItems   = 0;

        const domains = Array.from(this.domains.values()).flatMap(domain => {
            const budget = this.getDomainBudget(domain.id);
            if (!budget) return [];

            totalPayroll += budget.totals.payroll;
            totalItems   += budget.totals.items;

            return [{
                domainId:   domain.id,
                domainName: domain.name,
                payroll:    budget.payroll,
                items:      budget.items,
                totals:     budget.totals,
            }];
        });

        return {
            domains,
            totals: { payroll: totalPayroll, items: totalItems, total: totalPayroll + totalItems },
        };
    }

    // ── Pools ─────────────────────────────────────────────────────────────────

    getPool(id: string): LeaderPool | undefined { return this.pools.get(id); }
    getPools(): LeaderPool[] { return Array.from(this.pools.values()); }

    createPool(pool: LeaderPool): void {
        this.assertInit();
        this.pools.set(pool.id, pool);
        this.poolLoader?.save(pool);
    }

    savePool(pool: LeaderPool): void {
        this.poolLoader?.save(pool);
    }

    deletePool(id: string): boolean {
        this.assertInit();
        if (!this.pools.has(id)) return false;
        this.pools.delete(id);
        this.poolLoader?.delete(id);
        // Clear poolId on any domain referencing this pool
        for (const domain of this.domains.values()) {
            if (domain.poolId === id) {
                domain.poolId = null;
                this.domainLoader?.save(domain);
            }
        }
        return true;
    }

    // ── Payroll ───────────────────────────────────────────────────────────────

    /**
     * Pay all active roles in a domain from the given payer account (typically
     * the community treasury). Units themselves have no bank accounts — payroll
     * flows treasury → role holder.
     */
    async payDomainMonthly(domainId: string, bank: BankClient, payerAccountId: string): Promise<void> {
        const domain = this.domains.get(domainId);
        if (!domain) throw new Error(`Domain ${domainId} not found`);

        for (const unitId of domain.unitIds) {
            const unit = this.units.get(unitId);
            if (!unit) continue;
            await this._payRoles(payerAccountId, unit.roleIds, bank);
        }
    }

    private async _payRoles(payerAccountId: string, roleIds: string[], bank: BankClient): Promise<void> {
        const payerAccount = await bank.getAccountById(payerAccountId);
        if (!payerAccount) return;

        let remaining = payerAccount.amount;
        for (const roleId of roleIds) {
            const role = this.roles.get(roleId);
            if (!role || !role.isActive() || !role.memberId) continue;
            const amount = Math.round(role.kinPerMonth * 100) / 100;
            if (amount <= 0) continue;
            if (remaining < amount) {
                logger.warn(`[DomainService] cannot afford payroll for "${role.title}" (needs ${amount}, has ${remaining})`);
                continue;
            }
            const recipientAccount = await bank.getPrimaryAccountAsync(role.memberId);
            if (!recipientAccount) {
                logger.warn(`[DomainService] no primary account for role holder ${role.memberId} ("${role.title}")`);
                continue;
            }
            await bank.transfer(payerAccountId, recipientAccount.accountId, amount, `payroll: ${role.title}`);
            remaining -= amount;
        }
    }
}
