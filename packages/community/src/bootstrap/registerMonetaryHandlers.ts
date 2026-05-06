import logger from "../logger.js";
import { BankClient } from "@ecf/core";
import { Person } from "../person/Person.js";
import { PersonService } from "../person/PersonService.js";
import { CentralBank } from "../domains/central_bank/CentralBank.js";
import { SocialInsuranceBank } from "../domains/social_insurance/SocialInsuranceBank.js";
import { CommunityTreasury } from "../domains/community_treasury/CommunityTreasury.js";
import { DocumentLoader } from "../governance/DocumentLoader.js";
const docLoader = new DocumentLoader();
const cp = <T extends number | boolean>(key: string) => docLoader.getParam<T>("constitution", key);
import { CommunityLogService } from "../log/CommunityLogService.js";

/**
 * Register all monetary event handlers and periodic schedulers.
 * Called once during startup, after the BankClient is created.
 * The handlers are non-fatal — the bank may be unreachable at call time.
 */
export function registerMonetaryHandlers(bank: BankClient): void {

    // On join: just log. Bank account and endowment are deferred until
    // bank access is explicitly granted (see onPersonBankAccessGranted below).
    PersonService.getInstance().onPersonJoined(async (person) => {
        try {
            CommunityLogService.getInstance().write("member-joined", `${person.firstName} ${person.lastName} joined the community`, { actorId: person.id, refId: person.id });
        } catch { /* */ }
    });

    // On bank access granted: open a primary kin account and issue the age-derived endowment.
    PersonService.getInstance().onPersonBankAccessGranted(async (person) => {
        const displayName  = `${person.firstName} ${person.lastName}`;
        const centralBank  = CentralBank.getInstance();
        const siBank       = SocialInsuranceBank.getInstance();
        const treasury     = CommunityTreasury.getInstance();

        try {
            // Don't open a second account if they already have one (e.g. access was revoked and re-granted)
            const existing = await bank.getPrimaryAccountAsync(person.id);
            if (existing) {
                logger.info(`[community] @${person.handle} already has a bank account — skipping account creation`);
                return;
            }
            const memberAccount = await bank.openAccount(person.id, displayName, "kin", 0, person.handle, true);
            logger.info(`[community] opened bank account for @${person.handle}`);

            if (!centralBank.isReady() || !siBank.isReady() || !treasury.isReady()) {
                logger.warn(`[community] monetary institutions not ready — skipping issuance for @${person.handle}`);
                return;
            }

            const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
            const ageInYears  = Math.floor((Date.now() - person.birthDate.getTime()) / MS_PER_YEAR);
            const endowment   = ageInYears * cp<number>("kinPerPersonYear");

            if (endowment <= 0) {
                logger.info(`[community] zero endowment for @${person.handle} (age ${ageInYears}) — skipping issuance`);
                return;
            }

            const poolAmount     = Math.floor(endowment * cp<number>("endowmentPoolFraction"));
            const treasuryAmount = endowment - poolAmount;

            await centralBank.issue(endowment, treasury.accountId,          "join endowment — community fund");
            await treasury.transfer(siBank.poolAccountId, poolAmount,       "join endowment — insurance fund");

            siBank.recordContribution(person.id, poolAmount);

            logger.info(
                `[community] issued join endowment for @${person.handle}: ` +
                `${endowment} kin (community treasury: ${treasuryAmount}, insurance: ${poolAmount})`,
            );
        } catch (err) {
            logger.warn(`[community] bank access grant handler failed for @${person.handle}: ${(err as Error).message}`);
        }
    });

    // On discharge (departure or death): retire the person's endowment from
    // circulation. Target retirement = floor(age in years) × kinPerPersonYear.
    // The person's entire balance is transferred to the central bank and retired.
    // If balance >= target: the surplus goes to the community treasury.
    // If balance < target: the shortfall is recorded and gradually recouped via
    // the regular demurrage cycle.
    PersonService.getInstance().onPersonDischarged(async (person) => {
        const centralBank  = CentralBank.getInstance();
        const treasury     = CommunityTreasury.getInstance();

        if (!centralBank.isReady() || !treasury.isReady()) {
            logger.warn(`[community] monetary institutions not ready — skipping discharge settlement for @${person.handle}`);
            return;
        }

        try {
            const memberAccount = await bank.getPrimaryAccountAsync(person.id);
            if (!memberAccount) {
                logger.warn(`[community] no bank account found for @${person.handle} — skipping discharge settlement`);
                return;
            }

            const MS_PER_YEAR   = 365.25 * 24 * 60 * 60 * 1000;
            const ageInYears    = Math.floor((Date.now() - person.birthDate.getTime()) / MS_PER_YEAR);
            const targetRetire  = ageInYears * cp<number>("kinPerPersonYear");
            const balance       = memberAccount.amount;

            if (balance > 0) {
                // Retire the full balance from circulation
                await centralBank.retire(balance, memberAccount.accountId,
                    `discharge settlement — @${person.handle}`);
            }

            if (balance >= targetRetire) {
                // Surplus above the endowment target goes to the community treasury
                const surplus = balance - targetRetire;
                if (surplus > 0) {
                    await centralBank.issue(surplus, treasury.accountId,
                        `discharge surplus — @${person.handle}`);
                    logger.info(`[community] discharge @${person.handle}: retired ${targetRetire}, surplus ${surplus} kin → treasury`);
                } else {
                    logger.info(`[community] discharge @${person.handle}: retired ${balance} kin (exact)`);
                }
            } else {
                // Shortfall — record it for gradual demurrage recovery
                const shortfall = targetRetire - balance;
                centralBank.recordDischargeShortfall(shortfall);
                logger.info(`[community] discharge @${person.handle}: retired ${balance} kin, shortfall ${shortfall} kin recorded`);
            }

            // All balances are now zero — close the accounts
            await bank.closeAccounts(person.id);
            logger.info(`[community] closed bank accounts for @${person.handle}`);
            try { CommunityLogService.getInstance().write("member-discharged", `${person.firstName} ${person.lastName} left the community`, { actorId: person.id, refId: person.id }); } catch { /* */ }
        } catch (err) {
            logger.warn(`[community] discharge handler failed for @${person.handle}: ${(err as Error).message}`);
        }
    });

    // Annual person-year issuance: on each member's birthday, issue one kinPerPersonYear
    // split by birthdayCirculationFraction (member) and the remainder (insurance pool).
    PersonService.getInstance().onPersonAnniversary(async (person) => {
        const centralBank  = CentralBank.getInstance();
        const siBank       = SocialInsuranceBank.getInstance();
        const treasury     = CommunityTreasury.getInstance();

        if (!centralBank.isReady() || !siBank.isReady() || !treasury.isReady()) {
            logger.warn(`[community] monetary institutions not ready — skipping annual issuance for @${person.handle}`);
            return;
        }

        try {
            const memberAccount = await bank.getPrimaryAccountAsync(person.id);
            if (!memberAccount) {
                logger.warn(`[community] no primary account for @${person.handle} — skipping annual issuance`);
                return;
            }

            // All kin is issued into the community fund first; the fund then
            // distributes per policy: member fraction → member, remainder → insurance fund.
            const annual       = cp<number>("kinPerPersonYear");
            const memberAmount = Math.floor(annual * cp<number>("birthdayCirculationFraction"));
            const poolAmount   = annual - memberAmount;

            await centralBank.issue(annual, treasury.accountId, "annual issuance — community fund");
            await treasury.transfer(siBank.poolAccountId,    poolAmount,   "annual issuance — insurance fund");
            await treasury.transfer(memberAccount.accountId, memberAmount, "annual issuance — member share");

            siBank.recordContribution(person.id, poolAmount);

            logger.info(
                `[community] annual issuance for @${person.handle}: ` +
                `${annual} kin (insurance: ${poolAmount}, member: ${memberAmount})`,
            );
        } catch (err) {
            logger.warn(`[community] annual issuance failed for @${person.handle}: ${(err as Error).message}`);
        }
    });

    // Collect community dues monthly — moves kin from member accounts
    // to the treasury. Runs 30 days after startup, then every 30 days.
    // Excludes institutional accounts (issuance, SI pool, treasury itself).
    const runCommunityDues = (): void => {
        const centralBank  = CentralBank.getInstance();
        const siBank       = SocialInsuranceBank.getInstance();
        const treasury     = CommunityTreasury.getInstance();
        if (!centralBank.isReady() || !siBank.isReady() || !treasury.isReady()) {
            logger.warn("[community] monetary institutions not ready — skipping community dues collection");
            return;
        }
        treasury.collectDues(
            cp<number>("communityDuesRate"),
            cp<number>("demurrageFloor"),
            [centralBank.issuanceAccountId, siBank.poolAccountId],
        ).then(({ count }) => {
            logger.info(`[community] community dues collected from ${count} accounts`);
            try { CommunityLogService.getInstance().write("dues-collected", `Monthly dues collected from ${count} accounts`); } catch { /* */ }
        }).catch(err => {
            logger.error({ err }, "[community] community dues collection failed");
        });
    };
    // Run the dues check daily; collectDues() fires only when a full 30-day
    // cycle has elapsed. Using a daily tick avoids Node.js's 32-bit timer
    // overflow (setTimeout > ~24.8 days fires immediately).
    let lastDuesDate: Date | null = null;
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    setInterval(() => {
        const now = new Date();
        if (
            lastDuesDate === null ||
            now.getTime() - lastDuesDate.getTime() >= 30 * MS_PER_DAY
        ) {
            lastDuesDate = now;
            runCommunityDues();
        }
    }, MS_PER_DAY);

    // Check birthdays once at startup, then every 24 hours.
    const runAnniversaryCheck = (): void => {
        PersonService.getInstance().checkAnniversaries().catch(err =>
            (err: unknown) => logger.error({ err }, "[community] anniversary check failed"),
        );
    };
    runAnniversaryCheck();
    setInterval(runAnniversaryCheck, 24 * 60 * 60 * 1000);

    // Issue monthly retirement payments to all persons who have reached
    // retirementAge. Runs daily; fires only when 30 days have elapsed since
    // the last payout. Automatically marks persons as retired when they first
    // cross the threshold — no steward action required.
    const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
    const runRetirementPayouts = (): void => {
        const siBank       = SocialInsuranceBank.getInstance();
        const personSvc    = PersonService.getInstance();

        if (!siBank.isReady()) {
            logger.warn("[community] SI bank not ready — skipping retirement payouts");
            return;
        }

        const retirementAge = cp<number>("retirementAge");
        const payoutRate    = cp<number>("retirementPayoutRate");
        const now           = Date.now();

        // Collect eligible persons; auto-flag anyone newly past retirement age.
        const eligible: Person[] = [];
        for (const person of personSvc.getAll()) {
            if (person.disabled || !person.birthDate) continue;
            const ageYears = (now - person.birthDate.getTime()) / MS_PER_YEAR;
            if (ageYears >= retirementAge) {
                if (!person.retired) {
                    personSvc.update(person.id, { retired: true });
                    logger.info(`[community] @${person.handle} reached retirement age — marked retired`);
                }
                eligible.push(person);
            }
        }

        if (eligible.length === 0) return;

        siBank.issueMonthlyPayments(eligible, payoutRate).then(() => {
            logger.info(`[community] retirement payouts issued to ${eligible.length} retirees`);
        }).catch((err: unknown) => {
            logger.error({ err }, "[community] retirement payout failed");
        });
    };

    let lastRetirementDate: Date | null = null;
    setInterval(() => {
        const now = new Date();
        if (
            lastRetirementDate === null ||
            now.getTime() - lastRetirementDate.getTime() >= 30 * MS_PER_DAY
        ) {
            lastRetirementDate = now;
            runRetirementPayouts();
        }
    }, MS_PER_DAY);
}
