import { Request, Response } from "express";
import { CentralBank } from "../domains/central_bank/CentralBank.js";
import { SocialInsuranceBank } from "../domains/social_insurance/SocialInsuranceBank.js";
import { ConstitutionLoader } from "../governance/ConstitutionLoader.js";
import { PersonService } from "../person/PersonService.js";
import { nodeBankClient as bankClient } from "../nodeBankClient.js";
import { HealthcareDomain } from "../domains/healthcare/HealthcareDomain.js";

// GET /api/economics — public, no auth required.
// Returns live monetary data: kin/kithe in circulation and SI pool stats.
// Returns { ready: false } when the bank is unreachable.
export async function getEconomics(_req: Request, res: Response): Promise<void> {
    const cb = CentralBank.getInstance();
    const si = SocialInsuranceBank.getInstance();

    if (!cb.isReady()) {
        res.json({ ready: false, centralBank: null, socialInsurance: null });
        return;
    }

    const bank = bankClient();

    const [cbAccount, siAccount] = await Promise.all([
        bank.getAccountById(cb.issuanceAccountId),
        si.isReady() ? bank.getAccountById(si.poolAccountId) : Promise.resolve(null),
    ]);

    const constitution = ConstitutionLoader.getInstance();
    const persons      = PersonService.getInstance().getAll();
    const now          = new Date();
    const workingMin   = constitution.workingAgeMin;
    const retireAge    = constitution.retirementAge;

    let children = 0, workingAge = 0, retired = 0, disabled = 0;
    let totalPersonYears = 0;
    for (const p of persons) {
        const age = p.getAgeYears(now);
        totalPersonYears += age;
        if (p.disabled) { disabled++; continue; }
        if (p.retired || age >= retireAge) { retired++; continue; }
        if (age < workingMin) { children++; } else { workingAge++; }
    }
    const total = persons.length;

    res.json({
        ready: true,
        centralBank: {
            kinInCirculation:  cbAccount ? Math.max(0, -cbAccount.amount) : 0,
        },
        socialInsurance: si.isReady() ? {
            poolBalance:       siAccount?.amount ?? 0,
            totalContributed:  si.getTotalPoolContributed(),
            totalPaidOut:      si.getTotalPaidOut(),
            memberCount:       si.getMemberCount(),
        } : null,
        demographics: {
            total,
            workingAge,
            children,
            retired,
            disabled,
            workingAgeMin:  workingMin,
            retirementAge:  retireAge,
            totalPersonYears,
        },
        healthcareStaffing: HealthcareDomain.staffingHeuristic(total),
    });
}


