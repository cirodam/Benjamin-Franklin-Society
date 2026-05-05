import express from "express";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
import { initServiceNode, resolveCommunityIdentity, networkRouter, messageRouter } from "@ecf/core";
import { Bank } from "./Bank.js";
import { AccountLoader } from "./AccountLoader.js";
import { TransactionLoader } from "./TransactionLoader.js";
import { BankCharterLoader } from "./BankCharterLoader.js";
import { AccountOwnerLoader } from "./AccountOwnerLoader.js";
import { BankDb } from "./BankDb.js";
import { AccountOwnerService } from "./AccountOwnerService.js";
import bankRoutes from "./routes/bankRoutes.js";
import ownerRoutes from "./routes/ownerRoutes.js";
import { setCommunityIdentity } from "./communityIdentity.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT      = Number(process.env.PORT     ?? 3001);
const DATA_DIR  = process.env.DATA_DIR         ?? join(__dirname, "../../data");
const COMMUNITY_URL = process.env.COMMUNITY_URL ?? "http://localhost:3002";

const app = express();

app.use(express.json({
    verify: (req, _res, buf) => {
        (req as typeof req & { rawBody: string }).rawBody = buf.toString("utf-8");
    },
}));

async function main(): Promise<void> {
    await initServiceNode({
        name:         "bank",
        port:         PORT,
        dataDir:      resolve(DATA_DIR),
        communityUrl: COMMUNITY_URL,
        seeds:        process.env.BOOTSTRAP_PEERS,
    });

    BankDb.init(resolve(DATA_DIR));
    const accountLoader      = new AccountLoader();
    const transactionLoader  = new TransactionLoader();
    const ownerLoader        = new AccountOwnerLoader();
    Bank.getInstance().init(accountLoader, transactionLoader);
    AccountOwnerService.getInstance().init(ownerLoader);

    // Register all routes and start listening BEFORE resolving the governing
    // community's identity.  Auth middleware closures call getCommunityIdentity()
    // at request time, so they'll work once identity is set.  Requests that need
    // auth arriving before identity resolves will get a 500 — acceptable during
    // the brief startup window.  This breaks the circular startup deadlock where
    // the federation-bank and federation node each wait for the other.
    app.get("/health", (_req, res) => { res.json({ status: "ok" }); });
    app.use("/api", bankRoutes);
    app.use("/api", ownerRoutes);
    app.use("/api/node",    networkRouter);
    app.use("/api/message", messageRouter);

    // Dynamic charter endpoint — 503 until identity is resolved
    let charter: import("./BankCharterLoader.js").BankCharter | null = null;
    app.get("/api/charter", (_req, res) => {
        if (!charter) { res.status(503).json({ error: "Bank not yet chartered" }); return; }
        res.json(charter);
    });

    // Public config — tells the frontend the browser-accessible service URLs
    app.get("/api/config", (_req, res) => {
        res.json({
            communityUrl: process.env.PUBLIC_COMMUNITY_URL ?? COMMUNITY_URL,
            bankUrl:      process.env.PUBLIC_BANK_URL      ?? `http://localhost:${PORT}`,
            marketUrl:    process.env.PUBLIC_MARKET_URL    ?? "http://localhost:3003",
            mailUrl:      process.env.PUBLIC_MAIL_URL      ?? "http://localhost:3020",
            atheneumUrl:  process.env.PUBLIC_ATHENEUM_URL  ?? "http://localhost:3004",
            grangeUrl:    process.env.PUBLIC_GRANGE_URL    ?? "http://localhost:3005",
        });
    });

    // Serve frontend (production build from public/)
    const publicDir = join(__dirname, "../public");
    app.use(express.static(publicDir));
    app.get("*splat", (_req, res) => {
        res.sendFile(join(publicDir, "index.html"));
    });

    await new Promise<void>(r => app.listen(PORT, () => {
        console.log(`[bank] listening on port ${PORT}`);
        r();
    }));

    // Resolve the governing community's identity non-blocking.  Auth middleware
    // on bankRoutes depends on this; it resolves quickly once the community/
    // federation node is reachable.
    const ownerType = process.env.OWNER_TYPE as "community" | "federation" | undefined ?? "community";
    if (ownerType !== "community" && ownerType !== "federation") {
        throw new Error(`[bank] OWNER_TYPE must be "community" or "federation", got "${ownerType}"`);
    }

    const explicitId  = process.env.OWNER_NODE_ID;
    const explicitKey = process.env.COMMUNITY_PUBLIC_KEY;
    const identityPromise = (explicitId && explicitKey)
        ? Promise.resolve({ nodeId: explicitId, publicKey: explicitKey })
        : resolveCommunityIdentity(COMMUNITY_URL, "[bank]");

    identityPromise
        .then(community => {
            setCommunityIdentity(community.nodeId, community.publicKey);
            charter = new BankCharterLoader().load(community.nodeId, ownerType);
        })
        .catch(err => {
            console.error("[bank] identity resolution failed:", err);
            process.exit(1);
        });
}

main().catch(err => {
    console.error("[bank] startup failed:", err);
    process.exit(1);
});

export { Bank } from "./Bank.js";
export { BankAccount } from "./BankAccount.js";
export { BankTransaction } from "./BankTransaction.js";
export type { Currency } from "./BankTransaction.js";
export { AccountLoader } from "./AccountLoader.js";
export { TransactionLoader } from "./TransactionLoader.js";
export { BankCharterLoader } from "./BankCharterLoader.js";
export type { BankCharter, CharterOwnerType } from "./BankCharterLoader.js";
export { AccountOwner } from "./AccountOwner.js";
export type { AccountOwnerRecord, OwnerType } from "./AccountOwner.js";
export { AccountOwnerLoader } from "./AccountOwnerLoader.js";
export { AccountOwnerService } from "./AccountOwnerService.js";
export type { CreateOwnerOptions } from "./AccountOwnerService.js";
