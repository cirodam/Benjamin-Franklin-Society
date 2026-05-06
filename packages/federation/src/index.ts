import express from "express";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
import { NodeService, DataManifest, networkRouter, messageRouter, MessageDispatcher } from "@ecf/core";
import { FederationMemberLoader } from "./FederationMemberLoader.js";
import { FederationMemberService } from "./FederationMemberService.js";
import { FederationApplicationLoader } from "./FederationApplicationLoader.js";
import { FederationApplicationService } from "./FederationApplicationService.js";
import { FederationClearingHouse } from "./domains/central_bank/FederationClearingHouse.js";
import { FederationClearingHouseLoader } from "./domains/central_bank/FederationClearingHouseLoader.js";
import { FederationTreasury } from "./domains/treasury/FederationTreasury.js";
import { FederationTreasuryLoader } from "./domains/treasury/FederationTreasuryLoader.js";
import { FederationConstitution } from "./governance/FederationConstitution.js";
import { FederationDomainService } from "./common/FederationDomainService.js";
import { MediationDomain } from "./domains/mediation/MediationDomain.js";
import { LogisticsDomain } from "./domains/logistics/LogisticsDomain.js";
import { HealthInsuranceDomain } from "./domains/health_insurance/HealthInsuranceDomain.js";
import { HealthInsuranceClaimLoader } from "./domains/health_insurance/HealthInsuranceClaimLoader.js";
import { FederationMotionLoader } from "./governance/FederationMotionLoader.js";
import { FederationMotionService } from "./governance/FederationMotionService.js";
import { AssemblyTermLoader } from "@ecf/core";
import { FederationAssemblyService } from "./governance/FederationAssemblyService.js";
import { BankClient } from "@ecf/core";
import { CensusRecordLoader } from "./census/CensusRecordLoader.js";
import { FederationCensusService } from "./census/FederationCensusService.js";
import federationRoutes from "./routes/federationRoutes.js";
import { FederationDemurrageScheduler } from "./FederationDemurrageScheduler.js";
import { CommonwealthMembershipService } from "./CommonwealthMembershipService.js";
import { handleCensusMessage, handleBankTransferRoute } from "./routes/FederationController.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT                  = Number(process.env.PORT     ?? 3010);
const DATA_DIR              = process.env.DATA_DIR ?? join(__dirname, "../../data");
const BANK_URL              = process.env.BANK_URL  ?? "http://localhost:3011";
const PUBLIC_COMMUNITY_URL  = process.env.PUBLIC_COMMUNITY_URL  ?? "http://localhost:3002";
const PUBLIC_FEDERATION_URL = process.env.PUBLIC_FEDERATION_URL ?? `http://localhost:${PORT}`;
// Backend-to-backend URL for the community node.  In Docker this differs from
// PUBLIC_COMMUNITY_URL (e.g. http://community:3002 vs http://localhost:3002).
// Defaults to PUBLIC_COMMUNITY_URL so single-host / production setups need
// only one variable.
const COMMUNITY_URL = process.env.COMMUNITY_URL ?? PUBLIC_COMMUNITY_URL;

const FOUNDING_COMMUNITY_URL    = process.env.FOUNDING_COMMUNITY_URL    ?? "";
const FOUNDING_COMMONWEALTH_URL = process.env.FOUNDING_COMMONWEALTH_URL ?? "";

// Set after bank domain init so the setup endpoint can use it
let bankClientRef: BankClient | null = null;

const app = express();

app.use(express.json({
    verify: (req, _res, buf) => {
        (req as typeof req & { rawBody: string }).rawBody = buf.toString("utf-8");
    },
}));

/**
 * Register a community as the founding member of this federation.
 *
 * Protocol:
 *  1. GET <communityUrl>/api/federation/bootstrap  — fetch identity + memberCount
 *  2. Register the community internally with a correct credit line
 *  3. POST <communityUrl>/api/federation/register  — notify the community so it
 *     can record its own approved membership state (community verifies by calling
 *     back to our /api/members before accepting)
 */
async function registerFoundingCommunity(communityUrl: string, bank: BankClient): Promise<void> {
    const memberSvc = FederationMemberService.getInstance();
    if (memberSvc.getAll().some(m => m.isFounder)) {
        throw new Error("Federation already has a founding member");
    }

    const base = communityUrl.replace(/\/$/, "");

    // ── Step 1: fetch bootstrap data from community ──────────────────────────
    let identity: { nodeId: string; entityId?: string; publicKey: string; name: string; handle?: string; url?: string; memberCount?: number };
    const bootstrapRes = await fetch(`${base}/api/federation/bootstrap`);
    if (bootstrapRes.ok) {
        identity = await bootstrapRes.json() as typeof identity;
    } else {
        // Older community nodes — fall back to /api/identity (no memberCount)
        const idRes = await fetch(`${base}/api/identity`);
        if (!idRes.ok) throw new Error(`HTTP ${idRes.status} from ${base}/api/identity`);
        const id = await idRes.json() as { id: string; entityId?: string; publicKey: string; name: string; handle?: string };
        identity = { nodeId: id.id, ...id, memberCount: 0 };
    }

    const handle = identity.handle?.trim()
        || identity.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32)
        || "founding-community";

    const entityId    = identity.entityId ?? identity.nodeId;
    const memberCount = identity.memberCount ?? 0;

    // ── Step 2: register internally and open bank account ───────────────────
    const member  = memberSvc.add(identity.name, handle, identity.nodeId, identity.publicKey, base, entityId, true);
    const owner   = await bank.createOwner("institution", identity.name);
    const account = await bank.openAccount(owner.ownerId, `${identity.name} — kithe reserve`, "kithe");
    memberSvc.setBankAccount(member.id, account.accountId);

    // Set credit line immediately if we know the member count
    if (memberCount > 0) {
        const creditLine = memberCount * FederationConstitution.getInstance().creditLineKinPerPerson;
        memberSvc.setCreditLine(member.id, creditLine);
        console.log(`[federation] founding member credit line set to ${creditLine} kin (${memberCount} members × ${FederationConstitution.getInstance().creditLineKinPerPerson})`);
    }

    console.log(`[federation] founding member registered: "${identity.name}" (member ${member.id})`);

    // ── Step 3: notify the community ─────────────────────────────────────────
    // Non-fatal: the community can also poll or apply manually later.
    try {
        const notify = await fetch(`${base}/api/federation/register`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({
                federationUrl:   NodeService.getInstance().getIdentity().address,
                communityHandle: handle,
                memberId:        member.id,
                bankAccountId:   account.accountId,
            }),
        });
        if (notify.ok) {
            console.log(`[federation] community notified of founding registration`);
        } else {
            const err = await notify.json().catch(() => ({})) as { error?: string };
            console.warn(`[federation] community register callback returned ${notify.status}: ${err.error ?? "unknown"}`);
        }
    } catch (err) {
        console.warn(`[federation] could not notify community of founding registration: ${(err as Error).message}`);
    }
}

/**
 * If FOUNDING_COMMUNITY_URL is set, register it automatically on first boot
 * (convenience for fully-automated deployments). Retries with backoff.
 */
async function bootstrapFoundingMember(bank: BankClient, attempt = 1): Promise<void> {
    if (!FOUNDING_COMMUNITY_URL) return;
    const memberSvc = FederationMemberService.getInstance();
    if (memberSvc.getAll().some(m => m.isFounder)) return;

    try {
        await registerFoundingCommunity(FOUNDING_COMMUNITY_URL, bank);
    } catch (err) {
        const delay = Math.min(30_000, attempt * 5_000);
        console.warn(
            `[federation] could not reach founding community at ${FOUNDING_COMMUNITY_URL} ` +
            `(attempt ${attempt}), retrying in ${delay / 1000}s: ${(err as Error).message}`,
        );
        await new Promise<void>(resolve => setTimeout(resolve, delay));
        return bootstrapFoundingMember(bank, attempt + 1);
    }
}

/**
 * Wait until the federation bank responds on /health.
 * Retries indefinitely with increasing backoff so a slow docker-compose startup
 * doesn't crash the federation on first boot.
 */
async function waitForBank(attempt = 1): Promise<void> {
    try {
        const res = await fetch(`${BANK_URL}/health`);
        if (res.ok) return;
        throw new Error(`HTTP ${res.status}`);
    } catch (err) {
        const delay = Math.min(30_000, attempt * 2_000);
        console.warn(
            `[federation] waiting for bank at ${BANK_URL} ` +
            `(attempt ${attempt}): ${(err as Error).message} — retrying in ${delay / 1000}s`,
        );
        await new Promise<void>(r => setTimeout(r, delay));
        return waitForBank(attempt + 1);
    }
}

async function main(): Promise<void> {
    await NodeService.getInstance().init({
        type:     "federation",
        name:     process.env.NODE_NAME     ?? "federation",
        address:  process.env.NODE_ADDRESS  ?? `http://localhost:${PORT}`,
        entityId: process.env.NODE_ENTITY_ID,
        dataDir:  resolve(DATA_DIR, "network"),
        seeds:    (process.env.BOOTSTRAP_PEERS ?? "").split(",").filter(Boolean),
    });

    DataManifest.getInstance().init(
        body => NodeService.getInstance().getSigner().signBody(body),
        NodeService.getInstance().getSigner().publicKeyHex,
    );

    // ── Serve /api/identity and /health immediately ────────────────────────
    // The federation-bank polls /api/identity to resolve our public key before
    // it can verify node-signed requests.  Start listening now so the bank can
    // unblock; the remaining API routes are registered later once fully ready.
    app.get("/api/identity", (_req, res) => {
        const node = NodeService.getInstance();
        const identity = node.getIdentity();
        let cwRecord: ReturnType<typeof CommonwealthMembershipService.prototype.getStatus> = null;
        try { cwRecord = CommonwealthMembershipService.getInstance().getStatus(); } catch { /* not yet init'd */ }
        res.json({
            id:                identity.id,
            entityId:          identity.entityId,
            publicKey:         node.getSigner().publicKeyHex,
            type:              "federation",
            name:              identity.name,
            handle:            cwRecord?.federationHandle    ?? null,
            commonwealthHandle: cwRecord?.commonwealthHandle ?? null,
            globeHandle:       cwRecord?.globeHandle         ?? null,
        });
    });
    app.get("/health", (_req, res) => {
        res.json({ status: "ok", bankUrl: BANK_URL });
    });
    app.get("/api/config", (_req, res) => {
        const isConfigured = FederationMemberService.getInstance().getAll().some(m => m.isFounder);
        res.json({
            communityUrl:          PUBLIC_COMMUNITY_URL,
            federationUrl:         PUBLIC_FEDERATION_URL,
            isConfigured,
            // True when COMMUNITY_URL env var is explicitly set — frontend can
            // skip the URL input and let the backend use its configured value.
            communityUrlPreset:    !!process.env.COMMUNITY_URL,
        });
    });

    // ── First-time setup ──────────────────────────────────────────────────
    // Only works while no founding member is registered.  Once configured,
    // returns 409 so the endpoint is effectively self-closing.
    app.post("/api/setup", async (req, res) => {
        const memberSvc = FederationMemberService.getInstance();
        if (memberSvc.getAll().some(m => m.isFounder)) {
            res.status(409).json({ error: "Federation is already configured" });
            return;
        }
        if (!bankClientRef) {
            res.status(503).json({ error: "Federation is still starting up, please try again shortly" });
            return;
        }
        // Prefer the env-configured backend URL (Docker-safe).  Fall back to
        // the value submitted by the browser if COMMUNITY_URL is not set.
        const submitted = (req.body as { communityUrl?: unknown }).communityUrl;
        const backendUrl = COMMUNITY_URL || (typeof submitted === "string" ? submitted.trim() : "");

        if (!backendUrl) {
            res.status(400).json({ error: "communityUrl is required (or set the COMMUNITY_URL env var)" });
            return;
        }
        try {
            const url = new URL(backendUrl);
            if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
        } catch {
            res.status(400).json({ error: "communityUrl must be a valid http(s) URL" });
            return;
        }
        try {
            await registerFoundingCommunity(backendUrl, bankClientRef);
            const member = memberSvc.getAll().find(m => m.isFounder)!;
            res.json({ success: true, member: { name: member.name, handle: member.handle, url: member.url } });
        } catch (err) {
            const msg = (err as Error).message;
            const status = msg.includes("already") ? 409 : 502;
            res.status(status).json({ error: msg });
        }
    });
    await new Promise<void>(r => app.listen(PORT, () => {
        console.log(`[federation] listening on port ${PORT} (bank: ${BANK_URL})`);
        r();
    }));

    // ── Member communities ─────────────────────────────────────────────────
    const memberLoader = new FederationMemberLoader(resolve(DATA_DIR, "members"));
    FederationMemberService.getInstance().init(memberLoader);

    const appLoader = new FederationApplicationLoader(resolve(DATA_DIR, "applications"));
    FederationApplicationService.getInstance().init(appLoader);

    // ── Wait for federation bank ────────────────────────────────────────
    await waitForBank();

    // ── Federation clearing house + treasury ───────────────────────────────
    // Retry with backoff: the bank registers its auth routes before identity is
    // fully resolved, so the first attempt may arrive while the bank is still
    // chartering itself and return 4xx/5xx.
    const bank = new BankClient(
        BANK_URL,
        body => NodeService.getInstance().getSigner().signBody(body),
        "kithe",
    );
    const chLoader       = new FederationClearingHouseLoader(resolve(DATA_DIR, "domains"));
    const treasuryLoader = new FederationTreasuryLoader(resolve(DATA_DIR, "domains"));

    for (let attempt = 1; ; attempt++) {
        try {
            await FederationClearingHouse.getInstance().init(bank, chLoader);
            await FederationTreasury.getInstance().init(bank, treasuryLoader);
            break;
        } catch (err) {
            const delay = Math.min(20_000, attempt * 3_000);
            console.warn(
                `[federation] bank domain init failed (attempt ${attempt}): ` +
                `${(err as Error).message} — retrying in ${delay / 1000}s`,
            );
            await new Promise<void>(r => setTimeout(r, delay));
        }
    }

    // ── Federation constitution ────────────────────────────────────────────
    FederationConstitution.getInstance().load(resolve(DATA_DIR, "governance"));

    // ── Member census ──────────────────────────────────────────────────────
    const censusLoader = new CensusRecordLoader(resolve(DATA_DIR, "census"));
    FederationCensusService.getInstance().init(censusLoader);

    // ── Governance — motions + assembly ────────────────────────────────────
    const motionLoader = new FederationMotionLoader(resolve(DATA_DIR, "motions"));
    FederationMotionService.getInstance().init(motionLoader);

    const assemblyTermLoader = new AssemblyTermLoader(resolve(DATA_DIR, "assembly"));
    FederationAssemblyService.getInstance().init(assemblyTermLoader);
    // Ensure new member communities get seats if they joined after the current term started
    FederationAssemblyService.getInstance().syncSeats();

    // ── Health insurance domain ─────────────────────────────────────────────
    const claimLoader = new HealthInsuranceClaimLoader(resolve(DATA_DIR, "insurance-claims"));
    await HealthInsuranceDomain.getInstance().init(bank, claimLoader, resolve(DATA_DIR, "insurance-pool"));

    // ── Federation functional domains ─────────────────────────────────────
    const domainSvc = FederationDomainService.getInstance();
    domainSvc.registerDomain(HealthInsuranceDomain.getInstance());
    domainSvc.registerDomain(LogisticsDomain.getInstance());
    domainSvc.registerDomain(MediationDomain.getInstance());
    // ── Commonwealth membership ─────────────────────────────────────────────
    CommonwealthMembershipService.getInstance(resolve(DATA_DIR, "network"));
    // Make bank client available to the /api/setup endpoint
    bankClientRef = bank;

    // ── Founding member bootstrap ──────────────────────────────────────────
    // Only runs if FOUNDING_COMMUNITY_URL is set (automated deployments).
    await bootstrapFoundingMember(bank);

    // ── Monthly demurrage sweep ────────────────────────────────────────────
    // Runs on the 1st of each month (UTC). Charges communities whose federation
    // account balance exceeds (creditLineKin × surplusThresholdMultiple) at
    // surplusDemurrageRate, flowing the excess to the treasury.
    new FederationDemurrageScheduler().start();

    // ── Message handlers ──────────────────────────────────────────
    const dispatcher = MessageDispatcher.getInstance();
    dispatcher.register("governance.census.submit", handleCensusMessage,     "sync");
    dispatcher.register("bank.transfer.route",      handleBankTransferRoute, "sync");

    // ── Routes (registered on the already-running server) ─────────────────
    app.use("/api",         federationRoutes);
    app.use("/api/node",    networkRouter);
    app.use("/api/message", messageRouter);

    // /api/identity is already registered above (early boot); re-register here
    // with the full cwRecord so the handle fields populate once CWS is ready.
    // Express uses the first matching handler, so we override with a new one.
    app.get("/api/identity", (_req, res) => {
        const node = NodeService.getInstance();
        const identity = node.getIdentity();
        const cwRecord = CommonwealthMembershipService.getInstance().getStatus();
        res.json({
            id:                identity.id,
            entityId:          identity.entityId,
            publicKey:         node.getSigner().publicKeyHex,
            type:              "federation",
            name:              identity.name,
            handle:            cwRecord?.federationHandle    ?? null,
            commonwealthHandle: cwRecord?.commonwealthHandle ?? null,
            globeHandle:       cwRecord?.globeHandle         ?? null,
        });
    });

    // Membership-chain endpoint — member communities resolve upstream URLs here
    app.get("/api/membership-chain", async (_req, res) => {
        const cwRecord = CommonwealthMembershipService.getInstance().getStatus();
        if (!cwRecord || cwRecord.status !== "approved") {
            res.json({ commonwealthUrl: null, commonwealthHandle: null, globeUrl: null, globeHandle: null });
            return;
        }

        let globeUrl: string | null = null;
        try {
            const r = await fetch(`${cwRecord.commonwealthUrl.replace(/\/$/, "")}/api/identity`);
            if (r.ok) {
                const id = await r.json() as { globeUrl?: string | null };
                globeUrl = id.globeUrl ?? null;
            }
        } catch { /* non-fatal */ }

        res.json({
            commonwealthUrl:    cwRecord.commonwealthUrl,
            commonwealthHandle: cwRecord.commonwealthHandle ?? null,
            globeUrl,
            globeHandle:        cwRecord.globeHandle ?? null,
        });
    });

    // Update /health with full status now that everything is ready
    app.get("/health", (_req, res) => {
        res.json({
            status:      "ok",
            bankUrl:     BANK_URL,
            memberCount: FederationMemberService.getInstance().getAll().length,
        });
    });

    // Serve frontend
    const publicDir = join(__dirname, "../public");
    app.use(express.static(publicDir));
    app.get("*splat", (_req, res) => {
        res.sendFile(join(publicDir, "index.html"));
    });
}

main().catch(err => {
    console.error("[federation] startup failed:", err);
    process.exit(1);
});
