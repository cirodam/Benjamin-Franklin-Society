import { Request, Response } from "express";
import { CentralBank } from "../domains/CentralBank.js";
import { SocialInsuranceBank } from "../domains/SocialInsuranceBank.js";
import { DocumentLoader } from "../governance/DocumentLoader.js";
import { PersonService } from "../person/PersonService.js";
import { nodeBankClient as bankClient } from "../nodeBankClient.js";

function healthcareStaffing(population: number) {
    const recommend = (ratioPerPerson: number) => ({
        recommended:    Math.max(1, Math.ceil(population / ratioPerPerson)),
        ratioPerPerson,
    });
    return {
        gp:           recommend(1_000),
        nurse:        recommend(300),
        dentist:      recommend(2_000),
        mentalHealth: recommend(1_500),
        paramedic:    recommend(1_000),
        midwife:      recommend(1_000),
    };
}

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

    const constitution = new DocumentLoader();
    const persons      = PersonService.getInstance().getAll();
    const now          = new Date();
    const workingMin   = constitution.getParam<number>("constitution", "workingAgeMin");
    const retireAge    = constitution.getParam<number>("constitution", "retirementAge");

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
        healthcareStaffing: healthcareStaffing(total),
    });
}


