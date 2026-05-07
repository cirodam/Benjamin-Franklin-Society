import { type Request, type Response } from "express";
import { NodeService, sendMessage, type EcfMessage, parseAddress } from "@ecf/core";
import { CentralBank } from "../domains/CentralBank.js";
import { FederationMembershipService } from "../FederationMembershipService.js";
import { nodeBankClient as bank } from "../nodeBankClient.js";
import { PersonService } from "../person/PersonService.js";

export interface TransferRouteBody {
    address: { community: string; federation?: string; commonwealth?: string; globe?: string };
    toAccountId: string;
    amount: number;
    fromAccountId?: string;
    memo?: string;
}

export interface TransferReceiveBody {
    toAccountId: string;
    amount: number;
    memo?: string;
}

/**
 * POST /api/transfers/out
 * Auth: requireAuth (person credential)
 *
 * Initiates an outbound kin transfer to a person in another community.
 * The sender's account is debited locally (kin retired from circulation),
 * then the federation's route-payment chain is called to deliver it.
 *
 * Body: {
 *   fromAccountId: string,        — payer's account in this community's bank
 *   toAccountId:   string,        — payee's account ID in the target community's bank
 *   toAddress: {
 *     community:    string,       — target community handle (required)
 *     federation?:  string,       — target federation handle (required for cross-federation)
 *     commonwealth?: string,      — required for cross-commonwealth
 *     globe?:        string,      — required for cross-globe
 *   },
 *   amount: number,
 *   memo?:  string,
 * }
 */
export async function sendTransfer(
    req: Request & { personId?: string },
    res: Response,
): Promise<void> {
    const { fromAccountId, toAccountId, toAddress, amount, memo } = req.body ?? {};

    if (typeof fromAccountId !== "string" || !fromAccountId) {
        res.status(400).json({ error: "fromAccountId is required" }); return;
    }
    if (typeof toAccountId !== "string" || !toAccountId) {
        res.status(400).json({ error: "toAccountId is required" }); return;
    }
    if (typeof toAddress?.community !== "string" || !toAddress.community) {
        res.status(400).json({ error: "toAddress.community is required" }); return;
    }
    if (typeof amount !== "number" || amount <= 0) {
        res.status(400).json({ error: "amount must be a positive number" }); return;
    }

    const fedSvc = FederationMembershipService.getInstance();
    const record = fedSvc.getStatus();
    if (!record || record.status !== "approved") {
        res.status(503).json({ error: "Community is not an approved federation member" }); return;
    }
    if (!record.federationAccountId) {
        res.status(503).json({ error: "Community has no federation clearing account" }); return;
    }

    const cb = CentralBank.getInstance();
    if (!cb.isReady()) {
        res.status(503).json({ error: "Central bank not ready" }); return;
    }

    const transferMemo = typeof memo === "string" ? memo
        : `outbound → ${toAddress.community}`;

    // Retire kin locally: debit fromAccountId, credit CentralBank issuance account
    try {
        await bank().transfer(fromAccountId, cb.issuanceAccountId, amount, transferMemo);
    } catch (err) {
        res.status(422).json({ error: (err as Error).message }); return;
    }

    // Call federation's route-payment, using community's clearing account as source
    const node = NodeService.getInstance();

    try {
        const ack = await sendMessage<TransferRouteBody>(
            record.federationUrl,
            "bank",
            "bank.transfer.route",
            {
                address:       toAddress,
                toAccountId,
                amount,
                fromAccountId: record.federationAccountId,
                memo:          transferMemo,
            },
            node.getSigner(),
            node.getIdentity().id,
            node.getIdentity().address,
        );

        if (ack.status !== "ok") {
            // Rollback: re-issue the kin to the sender
            await bank().transfer(cb.issuanceAccountId, fromAccountId, amount, "transfer rollback").catch(() => {});
            res.status(502).json({ error: `Routing failed: ${ack.error ?? ack.status}` }); return;
        }
    } catch (err) {
        // Rollback
        await bank().transfer(cb.issuanceAccountId, fromAccountId, amount, "transfer rollback").catch(() => {});
        res.status(502).json({ error: `Could not reach federation: ${(err as Error).message}` }); return;
    }

    res.status(201).json({ ok: true, amount, toAddress, toAccountId });
}

// ── EcfMessage handler ────────────────────────────────────────────────────────

/**
 * POST /api/transfers/send
 * Auth: requireAuth (person credential)
 *
 * Handle-based local transfer. Resolves `toAddress` (e.g. "alice@riverside")
 * and debits the sender's primary account, crediting the recipient's primary
 * account — entirely within this community's bank.
 *
 * Body: {
 *   toAddress: string,   — e.g. "alice" or "savings@alice" (community segment ignored for local transfers)
 *   amount:    number,
 *   memo?:     string,
 * }
 */
export async function sendTransferByHandle(
    req: Request & { personId?: string },
    res: Response,
): Promise<void> {
    const senderId = req.personId;
    if (!senderId) { res.status(401).json({ error: "Not authenticated" }); return; }

    const { toAddress: rawAddress, amount, memo } = req.body ?? {};

    if (typeof rawAddress !== "string" || !rawAddress.trim()) {
        res.status(400).json({ error: "toAddress is required" }); return;
    }
    if (typeof amount !== "number" || amount <= 0) {
        res.status(400).json({ error: "amount must be a positive number" }); return;
    }

    let parsed;
    try {
        parsed = parseAddress(rawAddress.trim());
    } catch (err) {
        res.status(400).json({ error: (err as Error).message }); return;
    }

    const entityHandle = parsed.entity;
    if (!entityHandle) {
        res.status(400).json({ error: "toAddress must include a person handle" }); return;
    }

    const recipient = PersonService.getInstance().getByHandle(entityHandle);
    if (!recipient) {
        res.status(404).json({ error: `No person found with handle "${entityHandle}"` }); return;
    }

    // Resolve the recipient's bank account
    const toAccountHandle = parsed.account;
    let toAccount: { accountId: string } | undefined;
    if (toAccountHandle) {
        const accounts = await bank().getAccounts(recipient.id);
        toAccount = accounts.find((a: { handle?: string }) => a.handle === toAccountHandle);
        if (!toAccount) {
            res.status(404).json({ error: `Recipient has no account with handle "${toAccountHandle}"` }); return;
        }
    } else {
        toAccount = await bank().getPrimaryAccountAsync(recipient.id);
        if (!toAccount) {
            res.status(404).json({ error: "Recipient has no primary account" }); return;
        }
    }

    // Resolve the sender's primary account
    const fromAccount = await bank().getPrimaryAccountAsync(senderId);
    if (!fromAccount) {
        res.status(404).json({ error: "You have no primary account" }); return;
    }

    try {
        await bank().transfer(
            fromAccount.accountId,
            toAccount.accountId,
            amount,
            typeof memo === "string" ? memo : "",
        );
    } catch (err) {
        res.status(422).json({ error: (err as Error).message }); return;
    }

    res.status(201).json({ ok: true, amount, toAddress: rawAddress });
}



/**
 * MessageDispatcher handler for "bank.transfer.receive".
 * Called by the federation (via EcfMessage) when an inbound transfer arrives.
 * Issues kin locally into the recipient's bank account.
 */
export async function handleBankTransferReceive(
    msg: EcfMessage<TransferReceiveBody>,
): Promise<{ ok: boolean }> {
    const record = FederationMembershipService.getInstance().getStatus();
    if (!record || msg.from !== record.federationUrl) {
        throw new Error("Unauthorized sender — not the registered federation");
    }

    const { toAccountId, amount, memo } = msg.body ?? {};

    if (typeof toAccountId !== "string" || !toAccountId) throw new Error("toAccountId is required");
    if (typeof amount !== "number" || amount <= 0)        throw new Error("amount must be a positive number");

    const cb = CentralBank.getInstance();
    if (!cb.isReady()) throw new Error("Central bank not ready");

    await bank().transfer(
        cb.issuanceAccountId,
        toAccountId,
        amount,
        typeof memo === "string" ? memo : "inbound transfer",
    );

    return { ok: true };
}
