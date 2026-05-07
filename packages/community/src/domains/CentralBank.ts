import logger from "../logger.js";
import { BankClient } from "@ecf/core";
import { CentralBankLoader } from "./CentralBankLoader.js";
import { FunctionalDomain } from "@ecf/core";

/**
 * Stable domain ID — fixed so FunctionalDomainLoader can persist/restore
 * governance state (pools, roles) across restarts.
 */
export const CENTRAL_BANK_DOMAIN_ID = "ecf-domain-central-bank-0000000001";

/**
 * The Central Bank is the sole issuer of kin.
 *
 * As a FunctionalDomain it participates fully in community governance —
 * it can have a leader pool and community roles assigned to it. Its monetary
 * operations (issuance, demurrage) are the economic layer on top.
 *
 * It holds one issuance account with overdraftLimit = -Infinity. Going negative
 * on this account means kin is in circulation; returning to zero means it has
 * all been retired.
 *
 * Lifecycle:
 *   1. On first boot, `init()` registers an institutional AccountOwner with the
 *      bank and opens the issuance account (overdraftLimit null → -Infinity).
 *   2. On subsequent boots, `init()` loads the persisted IDs and verifies
 *      the issuance account still exists.
 */
export class CentralBank extends FunctionalDomain {
    private static instance: CentralBank;

    private _ownerId!: string;
    private _issuanceAccountId!: string;
    private _bank!: BankClient;
    private _loader!: CentralBankLoader;
    private _ready = false;
    /** Cumulative kin that could not be retired at discharge time. */
    private _dischargeShortfall = 0;

    private constructor() {
        super("Central Bank", "Sole issuer of kin. Issues one person-year of kin per person per year.", CENTRAL_BANK_DOMAIN_ID);
    }

    static getInstance(): CentralBank {
        if (!CentralBank.instance) CentralBank.instance = new CentralBank();
        return CentralBank.instance;
    }

    isReady(): boolean              { return this._ready; }
    get ownerId(): string           { if (!this._ready) throw new Error("CentralBank not ready"); return this._ownerId; }
    get issuanceAccountId(): string { if (!this._ready) throw new Error("CentralBank not ready"); return this._issuanceAccountId; }
    /** Accumulated kin still owed to retirement, to be recouped via demurrage. */
    get dischargeShortfall(): number { return this._dischargeShortfall; }

    async init(bank: BankClient, loader: CentralBankLoader): Promise<void> {
        this._bank   = bank;
        this._loader = loader;

        if (loader.exists()) {
            const record = loader.load();
            this._ownerId           = record.ownerId;
            this._issuanceAccountId = record.issuanceAccountId;
            this._dischargeShortfall = record.dischargeShortfall ?? 0;
            this._ready = true;
            return;
        }

        // First boot — register with the bank
        const owner = await bank.createOwner("institution", "Central Bank");
        this._ownerId = owner.ownerId;

        const account = await bank.openAccount(
            this._ownerId,
            "Central Bank",
            "kin",
            null, // null → overdraftLimit -Infinity on the bank side
            "issuance",
            true,
        );
        this._issuanceAccountId = account.accountId;

        loader.save({
            ownerId:           this._ownerId,
            issuanceAccountId: this._issuanceAccountId,
            registeredAt:      new Date().toISOString(),
            dischargeShortfall: 0,
        });
        this._ready = true;
    }

    // ── Money operations ────────────────────────────────────────────────────

    /**
     * Issue kin into circulation by transferring from the issuance account
     * (which may go arbitrarily negative) to a recipient account.
     */
    async issue(amount: number, recipientAccountId: string, memo = "kin issuance"): Promise<void> {
        await this._bank.transfer(this._issuanceAccountId, recipientAccountId, amount, memo);
    }

    /**
     * Retire kin from circulation by pulling it back into the issuance account.
     */
    async retire(amount: number, sourceAccountId: string, memo = "kin retirement"): Promise<void> {
        await this._bank.transfer(sourceAccountId, this._issuanceAccountId, amount, memo);
    }

    /**
     * Record a discharge shortfall — kin that should have been retired when a
     * member left but wasn't available in their account. The shortfall is
     * persisted and gradually recouped via the regular demurrage cycle.
     */
    recordDischargeShortfall(amount: number): void {
        if (amount <= 0) return;
        this._dischargeShortfall += amount;
        const record = this._loader.load();
        this._loader.save({ ...record, dischargeShortfall: this._dischargeShortfall });
        logger.info(`[central-bank] discharge shortfall +${amount} kin (total: ${this._dischargeShortfall})`);
    }

    /**
     * Reduce the tracked shortfall (called after demurrage has retired some of
     * the outstanding amount).
     */
    clearDischargeShortfall(amount: number): void {
        this._dischargeShortfall = Math.max(0, this._dischargeShortfall - amount);
        const record = this._loader.load();
        this._loader.save({ ...record, dischargeShortfall: this._dischargeShortfall });
    }

    /**
     * Apply demurrage to all kin accounts. Collected fees flow into the
     * issuance account, effectively retiring that value from circulation.
     *
     * @param rate  Fraction of balance to collect, e.g. 0.02 = 2%
     * @param memo  Recorded on each generated transaction
     */
    async applyDemurrage(
        rate: number,
        memo = "kin demurrage",
        excludeAccountIds: string[] = [],
        floor = 0,
    ): Promise<{ count: number }> {
        return this._bank.applyDemurrage("kin", rate, this._issuanceAccountId, memo, floor, excludeAccountIds);
    }
}
