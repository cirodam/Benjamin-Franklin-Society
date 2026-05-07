import { BankClient } from "@ecf/core";
import { CommunityTreasuryLoader } from "./CommunityTreasuryLoader.js";
import { FunctionalDomain } from "@ecf/core";

export const COMMUNITY_TREASURY_DOMAIN_ID = "ecf-domain-community-treasury-000002";

/**
 * The Community Treasury is the shared budget account for the community.
 *
 * Funded by two sources:
 *  1. A share of every new adult member's join endowment (the circulating
 *     fraction after the insurance pool allocation).
 *  2. Monthly community dues collected from all member accounts
 *     (communityDuesRate). This is distinct from Central Bank demurrage:
 *     demurrage retires kin from circulation; dues move kin from
 *     members to the treasury for the community to spend.
 *
 * Spending is a governance act — referenda and domain budget allocations
 * determine where funds go. The treasury has no opinion on outflows.
 */
export class CommunityTreasury extends FunctionalDomain {
    private static instance: CommunityTreasury;

    private _ownerId!: string;
    private _accountId!: string;
    private _bank!: BankClient;
    private _ready = false;

    private constructor() {
        super(
            "Community Treasury",
            "Shared budget account funded by member join endowments and monthly community budget injections. Spending is governed by referenda and domain budget allocations.",
            COMMUNITY_TREASURY_DOMAIN_ID,
        );
    }

    static getInstance(): CommunityTreasury {
        if (!CommunityTreasury.instance) {
            CommunityTreasury.instance = new CommunityTreasury();
        }
        return CommunityTreasury.instance;
    }

    isReady(): boolean       { return this._ready; }
    get ownerId(): string    { if (!this._ready) throw new Error("CommunityTreasury not ready"); return this._ownerId; }
    get accountId(): string  { if (!this._ready) throw new Error("CommunityTreasury not ready"); return this._accountId; }

    /**
     * Collect community dues from all member kin accounts into the treasury.
     *
     * Unlike Central Bank demurrage (which retires kin by routing to the
     * issuance account), dues move kin from members to the treasury
     * account — the money stays in circulation, just redistributed.
     *
     * @param rate             Fraction of each account balance to collect
     * @param floor            Balance floor exempt from dues
     * @param excludeAccountIds  Institutional accounts to skip (pool, issuance, treasury itself)
     */
    async collectDues(
        rate: number,
        floor = 0,
        excludeAccountIds: string[] = [],
    ): Promise<{ count: number }> {
        if (!this._ready) throw new Error("CommunityTreasury not ready");
        return this._bank.applyDemurrage(
            "kin",
            rate,
            this._accountId,
            "community dues",
            floor,
            [this._accountId, ...excludeAccountIds],
        );
    }

    async init(bank: BankClient, loader: CommunityTreasuryLoader): Promise<void> {
        this._bank = bank;

        if (loader.exists()) {
            const record     = loader.load();
            this._ownerId    = record.ownerId;
            this._accountId  = record.accountId;
            this._ready = true;
            return;
        }

        // First boot — register with the bank
        const owner = await bank.createOwner("institution", "Community Treasury");
        this._ownerId = owner.ownerId;

        // Treasury account: cannot go negative (it only holds received funds)
        const account = await bank.openAccount(
            this._ownerId,
            "Community Treasury",
            "kin",
            0,
            "treasury",
            true,
        );
        this._accountId = account.accountId;

        loader.save({
            ownerId:      this._ownerId,
            accountId:    this._accountId,
            registeredAt: new Date().toISOString(),
        });
        this._ready = true;
    }

    /**
     * Distribute kin from the treasury account to another account.
     * Used to enact policy-driven allocations (e.g. routing annual issuance
     * from the community fund to the insurance pool or a member's account).
     */
    async transfer(toAccountId: string, amount: number, memo: string): Promise<void> {
        if (!this._ready) throw new Error("CommunityTreasury not ready");
        await this._bank.transfer(this._accountId, toAccountId, amount, memo);
    }
}
