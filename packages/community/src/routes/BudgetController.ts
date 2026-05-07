import { Request, Response } from "express";
import { CentralBank } from "../domains/CentralBank.js";
import { SocialInsuranceBank } from "../domains/SocialInsuranceBank.js";
import { CommunityTreasury } from "../domains/CommunityTreasury.js";
import { DocumentLoader } from "../governance/DocumentLoader.js";
import { DomainService } from "../DomainService.js";
import { PersonService } from "../person/PersonService.js";
import { nodeBankClient as bankClient } from "../nodeBankClient.js";
import logger from "../logger.js";
import { ActivityLogService } from "@ecf/core";

/**
 * GET /api/budget — public transparency endpoint.
 *
 * Returns the community's full budget:
 *   inflow  — treasury balance + estimated monthly dues
 *   outflow — sum of every domain's payroll + budget line items
 *   solvency — whether monthly inflow covers monthly outflow
 */
export async function getCommunityBudget(_req: Request, res: Response): Promise<void> {
    const cb       = CentralBank.getInstance();
    const treasury = CommunityTreasury.getInstance();
    const docs     = new DocumentLoader();
    const cp = <T extends number | boolean>(k: string) => docs.getParam<T>("constitution", k);

    if (!cb.isReady() || !treasury.isReady()) {
        res.json({ ready: false });
        return;
    }

    try {
        const bank = bankClient();
        const si = SocialInsuranceBank.getInstance();

        const [cbAccount, treasuryAccount, siAccount] = await Promise.all([
            bank.getAccountById(cb.issuanceAccountId),
            bank.getAccountById(treasury.accountId),
            si.isReady() ? bank.getAccountById(si.poolAccountId) : Promise.resolve(null),
        ]);

        const kinInCirculation    = cbAccount ? Math.max(0, -cbAccount.amount) : 0;
        const duesRate            = cp<number>("communityDuesRate");
        const treasuryBalance     = treasuryAccount?.amount ?? 0;
        const siPoolBalance       = siAccount?.amount ?? 0;
        const duesableKin         = Math.max(0, kinInCirculation - siPoolBalance - treasuryBalance);
        const estimatedMonthlyDues = Math.round(duesableKin * duesRate * 100) / 100;

        const domainBudget        = DomainService.getInstance().getCommunityBudget();
        const memberCount          = PersonService.getInstance().count();
        const foodAllowancePerMember = 200;
        const monthlyOutflow       = domainBudget.totals.total + foodAllowancePerMember * memberCount;
        const solvent              = estimatedMonthlyDues >= monthlyOutflow;

        res.json({
            ready: true,
            inflow: {
                treasuryBalance,
                duesRate,
                estimatedMonthlyDues,
                kinInCirculation,
            },
            outflow: {
                monthlyTotal: monthlyOutflow,
                domains:      domainBudget.domains,
                totals:       domainBudget.totals,
            },
            memberCount,
            foodAllowancePerMember,
            solvent,
        });
    } catch (err) {
        res.status(502).json({ ready: false, error: "Bank unavailable" });
    }
}

/**
 * POST /api/budget/simulate-step — steward only, dev/testing helper.
 *
 * Runs one synthetic monthly cycle:
 *   1. Demurrage sweep (retires surplus kin)
 *   2. Community dues collection (moves kin → treasury)
 *   3. Food allowance distribution (treasury → each member's primary account)
 *   4. Payroll for every domain (moves kin from units/treasury → role holders)
 */
export async function simulateStep(_req: Request, res: Response): Promise<void> {
    const cb         = CentralBank.getInstance();
    const treasury   = CommunityTreasury.getInstance();
    const si         = SocialInsuranceBank.getInstance();
    const docs       = new DocumentLoader();
    const cp = <T extends number | boolean>(k: string) => docs.getParam<T>("constitution", k);

    if (!cb.isReady() || !treasury.isReady()) {
        res.status(503).json({ error: "Monetary institutions not ready" });
        return;
    }

    try {
        const bank = bankClient();
        const excludeIds = [cb.issuanceAccountId, treasury.accountId];
        if (si.isReady()) excludeIds.push(si.poolAccountId);

        // 1. Demurrage
        const { count: demurrageCount } = await cb.applyDemurrage(
            cp<number>("bankDemurrageRate"),
            "simulated demurrage",
            excludeIds,
            cp<number>("demurrageFloor"),
        );
        logger.info(`[simulate-step] demurrage applied to ${demurrageCount} accounts`);
        try { ActivityLogService.getInstance().write("demurrage-run", `Demurrage applied to ${demurrageCount} accounts`); } catch { /* */ }

        // 2. Dues
        const { count: duesCount } = await treasury.collectDues(
            cp<number>("communityDuesRate"),
            cp<number>("demurrageFloor"),
            [cb.issuanceAccountId, si.isReady() ? si.poolAccountId : ""],
        );
        logger.info(`[simulate-step] dues collected from ${duesCount} accounts`);

        // 3. Food allowance — distribute from treasury to every member
        const foodAllowancePerMember = 200;
        const members = PersonService.getInstance().getAll();
        let foodCount = 0;
        for (const person of members) {
            try {
                const account = await bank.getPrimaryAccountAsync(person.id);
                if (!account) continue;
                await treasury.transfer(account.accountId, foodAllowancePerMember, "food allowance");
                foodCount++;
            } catch {
                // member may have no bank account — skip
            }
        }
        logger.info(`[simulate-step] food allowance distributed to ${foodCount} members`);

        // 4. Payroll — pay every domain from treasury
        const domainSvc = DomainService.getInstance();
        const domains   = domainSvc.getCommunityBudget().domains;
        let payrollDomains = 0;
        for (const d of domains) {
            try {
                await domainSvc.payDomainMonthly(d.domainId, bank, treasury.accountId);
                payrollDomains++;
            } catch {
                // domain may have no units — skip
            }
        }
        logger.info(`[simulate-step] payroll run for ${payrollDomains} domains`);

        res.json({ ok: true, demurrageCount, duesCount, foodCount, payrollDomains });
    } catch (err) {
        logger.error({ err }, "[simulate-step] failed");
        res.status(502).json({ error: "Simulation failed: " + (err as Error).message });
    }
}
