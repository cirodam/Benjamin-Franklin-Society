import logger from "./logger.js";
import express from "express";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
import { NodeService, NodeSigner, ClusterService, DataManifest, networkRouter, messageRouter, parseRoutableAddress, MessageDispatcher } from "@ecf/core";
import { PaymentTokenService } from "./PaymentTokenService.js";
import { CommunityDb } from "./CommunityDb.js";
import { clusterRoutes } from "./routes/clusterRoutes.js";
import { PersonLoader } from "./person/PersonLoader.js";
import { PersonService } from "./person/PersonService.js";
import { Person } from "./person/Person.js";
import { pushCensus } from "./census/CensusService.js";
import { AssociationLoader } from "./association/AssociationLoader.js";
import { AssociationService } from "./association/AssociationService.js";
import { OrgLoader } from "./organization/OrgLoader.js";
import { OrgService } from "./organization/OrgService.js";
import { CalendarEventLoader } from "./calendar/CalendarEventLoader.js";
import { CalendarService } from "./calendar/CalendarService.js";
import { LocationLoader } from "./location/LocationLoader.js";
import { LocationService } from "./location/LocationService.js";
import { RoleTypeLoader } from "./common/RoleTypeLoader.js";
import { UnitTypeLoader } from "./common/domain/UnitTypeLoader.js";
import { CommunityRoleLoader } from "./common/domain/CommunityRoleLoader.js";
import { FunctionalUnitLoader } from "./common/domain/FunctionalUnitLoader.js";
import { FunctionalDomainLoader } from "./common/domain/FunctionalDomainLoader.js";
import { LeaderPoolLoader } from "./governance/LeaderPoolLoader.js";
import { Constitution } from "./governance/Constitution.js";
import { ConstitutionLoader } from "./governance/ConstitutionLoader.js";
import { MotionLoader } from "./governance/MotionLoader.js";
import { MotionService } from "./governance/MotionService.js";
import "./governance/effects/index.js"; // register built-in motion effect handlers
import { DomainService } from "./DomainService.js";
import { BankClient } from "@ecf/core";
import { CentralBank } from "./domains/central_bank/CentralBank.js";
import { CentralBankLoader } from "./domains/central_bank/CentralBankLoader.js";
import { SocialInsuranceBank } from "./domains/social_insurance/SocialInsuranceBank.js";
import { SocialInsuranceBankLoader } from "./domains/social_insurance/SocialInsuranceBankLoader.js";
import { SocialInsuranceMemberLoader } from "./domains/social_insurance/SocialInsuranceMemberLoader.js";
import communityRoutes from "./routes/communityRoutes.js";
import { handleInboundMail } from "./routes/MailRelayController.js";
import { handleBankTransferReceive } from "./routes/TransferController.js";
import { CommunityTreasury } from "./domains/community_treasury/CommunityTreasury.js";
import { CommunityTreasuryLoader } from "./domains/community_treasury/CommunityTreasuryLoader.js";
import { FederationMembershipService } from "./FederationMembershipService.js";
import { GsmModemProvider } from "./sms/GsmModemProvider.js";
import { SmsService } from "./sms/SmsService.js";
import { seedDomains } from "./bootstrap/seedDomains.js";
import { registerMonetaryHandlers } from "./bootstrap/registerMonetaryHandlers.js";
import { NominationLoader } from "./nomination/NominationLoader.js";
import { NominationService } from "./nomination/NominationService.js";
import { ShiftLoader } from "./shift/ShiftLoader.js";
import { ShiftService } from "./shift/ShiftService.js";
import { CommunityLogLoader } from "./log/CommunityLogLoader.js";
import { CommunityLogService } from "./log/CommunityLogService.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT             = Number(process.env.PORT              ?? 3002);
const DATA_DIR         = process.env.DATA_DIR         ?? join(__dirname, "../../data");
const BANK_URL         = process.env.BANK_URL          ?? "http://localhost:3001";
const CLUSTER_PEERS    = (process.env.CLUSTER_PEERS    ?? "").split(",").filter(Boolean);
const CLUSTER_PRIORITY = Number(process.env.CLUSTER_PRIORITY ?? 100);

const app = express();

app.use(express.json({
    verify: (req, _res, buf) => {
        (req as typeof req & { rawBody: string }).rawBody = buf.toString("utf-8");
    },
}));

async function main(): Promise<void> {
    // ── Node identity ──────────────────────────────────────────────────────
    await NodeService.getInstance().init({
        type:     "community",
        name:     process.env.NODE_NAME     ?? "community",
        address:  process.env.NODE_ADDRESS  ?? `http://localhost:${PORT}`,
        entityId: process.env.NODE_ENTITY_ID,
        dataDir:  resolve(DATA_DIR, "network"),
        seeds:    (process.env.BOOTSTRAP_PEERS ?? "").split(",").filter(Boolean),
    });

    // ── Community signer ──────────────────────────────────────────────────
    // In a multi-node cluster every replica must share the same community
    // key pair so that PersonCredentials and bank-auth requests are valid
    // regardless of which node issued them.
    //
    // Single-node mode: omit COMMUNITY_PRIVATE_KEY → falls back to the
    // per-node key generated by NodeService on first boot.
    //
    // Cluster mode: generate once with NodeSigner.generate(), distribute the
    // privateKeyDer hex to all replicas via COMMUNITY_PRIVATE_KEY.
    const communityPrivateKeyHex = process.env.COMMUNITY_PRIVATE_KEY;
    const communitySigner: NodeSigner = communityPrivateKeyHex
        ? NodeSigner.fromPrivateKeyHex(communityPrivateKeyHex)
        : NodeService.getInstance().getSigner();

    if (communityPrivateKeyHex) {
        logger.info(`[community] using shared community key (cluster mode) — pubkey: ${communitySigner.publicKeyHex.slice(0, 16)}…`);
    } else if (CLUSTER_PEERS.length > 0) {
        logger.warn(
            "[community] CLUSTER_PEERS is set but COMMUNITY_PRIVATE_KEY is not. " +
            "Each node will use its own key — credentials issued by one node will " +
            "NOT be accepted by others. Generate a shared key with:\n" +
            "  node -e \"const {generateKeyPairSync}=require('crypto');" +
            "const {privateKey}=generateKeyPairSync('ed25519');" +
            "console.log(privateKey.export({type:'pkcs8',format:'der'}).toString('hex'))\"\n" +
            "Then set COMMUNITY_PRIVATE_KEY on all cluster nodes."
        );
    }

    // ── Cluster coordination ───────────────────────────────────────────────
    const cluster = ClusterService.getInstance();
    await cluster.init({
        myUrl:    process.env.NODE_ADDRESS ?? `http://localhost:${PORT}`,
        priority: CLUSTER_PRIORITY,
        peers:    CLUSTER_PEERS,
        signer:   communitySigner,
        dataDir:  DATA_DIR,
    });

    // Cold-start: if we're a replica, pull the primary's state before
    // loading any services from disk. This ensures the replica starts
    // with a consistent copy of the community data.
    if (!cluster.isPrimary()) {
        logger.info("[cluster] starting as replica — pulling state from primary...");
        await cluster.syncFromPrimary();
        logger.info("[cluster] cold-start sync complete — booting services");
    }

    // ── Federation membership (community node owns the application process) ─
    FederationMembershipService.getInstance(DATA_DIR);

    // ── SQLite database (must be first — all loaders depend on it) ────────
    CommunityDb.init(resolve(DATA_DIR));

    DataManifest.getInstance().init(
        body => communitySigner.signBody(body),
        communitySigner.publicKeyHex,
    );

    // ── Constitution ───────────────────────────────────────────────────────
    const constitutionLoader = new ConstitutionLoader();
    constitutionLoader.load();
    Constitution.getInstance().init(constitutionLoader);

    // ── Persons ────────────────────────────────────────────────────────────
    const personLoader = new PersonLoader();
    PersonService.getInstance().init(personLoader);
    PersonService.getInstance().setCommunitySigner(communitySigner);

    // ── Associations ───────────────────────────────────────────────────────
    const associationLoader = new AssociationLoader();
    AssociationService.getInstance().init(associationLoader);

    // ── Organizations ──────────────────────────────────────────────────────
    const orgLoader = new OrgLoader();
    OrgService.getInstance().init(orgLoader);

    // ── Calendar ─────────────────────────────────────────────────────────────
    const calendarLoader = new CalendarEventLoader();
    CalendarService.getInstance().init(calendarLoader);

    // ── Locations ─────────────────────────────────────────────────────────────
    const locationLoader = new LocationLoader();
    LocationService.getInstance().init(locationLoader);

    // ── Community log ───────────────────────────────────────────────────────
    CommunityLogService.getInstance().init(new CommunityLogLoader());

    // ── Motions ────────────────────────────────────────────────────────────
    const motionLoader = new MotionLoader();
    MotionService.getInstance().init(motionLoader);

    // ── Payment tokens ─────────────────────────────────────────────────────
    // Auto-assemble RoutableAddress from federation membership record when approved,
    // fall back to ROUTABLE_ADDRESS env var for dev/bootstrap.
    const membership = FederationMembershipService.getInstance().getStatus();
    let routableAddress: import("@ecf/core").RoutableAddress;
    if (
        membership?.status === "approved" &&
        membership.communityHandle &&
        membership.federationHandle &&
        membership.commonwealthHandle
    ) {
        routableAddress = {
            commonwealth: membership.commonwealthHandle,
            federation:   membership.federationHandle,
            community:    membership.communityHandle,
        };
    } else {
        const raw = process.env.ROUTABLE_ADDRESS ?? "globe:local-federation:local-community";
        routableAddress = parseRoutableAddress(raw);
    }
    PaymentTokenService.getInstance().init(resolve(DATA_DIR, "payment-tokens"), routableAddress);

    // ── Domain registries ──────────────────────────────────────────────────
    const domainSvc = DomainService.getInstance();
    domainSvc.init(
        new FunctionalDomainLoader(),
        new FunctionalUnitLoader(),
        new CommunityRoleLoader(),
        new LeaderPoolLoader(),
    );

    // ── Role type bank ─────────────────────────────────────────────────────
    const roleTypeLoader = new RoleTypeLoader();
    domainSvc.initRoleTypes(roleTypeLoader);

    // ── Unit type bank ─────────────────────────────────────────────────────
    domainSvc.initUnitTypes(new UnitTypeLoader());

    seedDomains(domainSvc);

    // ── Nominations ────────────────────────────────────────────────────────
    const nominationLoader = new NominationLoader();
    NominationService.getInstance().init(nominationLoader);

    // ── Shifts ─────────────────────────────────────────────────────────────
    const shiftLoader = new ShiftLoader();
    ShiftService.getInstance().init(shiftLoader);

    // ── Monetary institutions (non-fatal — bank may be unreachable) ────────
    const bank = new BankClient(BANK_URL, body => communitySigner.signBody(body));

    registerMonetaryHandlers(bank);

    const centralBankLoader   = new CentralBankLoader();
    const siBankLoader        = new SocialInsuranceBankLoader();
    const siMemberLoader      = new SocialInsuranceMemberLoader();
    const treasuryLoader      = new CommunityTreasuryLoader();

    async function initMonetaryInstitutions(): Promise<void> {
        await CentralBank.getInstance().init(bank, centralBankLoader);
        await SocialInsuranceBank.getInstance().init(bank, siBankLoader, siMemberLoader);
        await CommunityTreasury.getInstance().init(bank, treasuryLoader);
        logger.info("[community] monetary institutions ready");
    }

    async function tryInitMonetary(attempt = 1): Promise<void> {
        try {
            await initMonetaryInstitutions();
        } catch (err) {
            const delay = Math.min(30_000, attempt * 5_000);
            logger.warn(
                `[community] bank unreachable (attempt ${attempt}), ` +
                `running in degraded mode — retrying in ${delay / 1000}s. ` +
                `Error: ${(err as Error).message}`,
            );
            setTimeout(() => tryInitMonetary(attempt + 1), delay);
        }
    }

    // Start without awaiting — governance routes come up immediately.
    void tryInitMonetary();

    // ── SMS banking (non-fatal — modem may not be present) ────────────────
    // Set SMS_MODEM_PATH to enable (e.g. /dev/ttyUSB0).
    // In Docker, pass the device through:
    //   devices:
    //     - "/dev/ttyUSB0:/dev/ttyUSB0"
    const modemPath = process.env.SMS_MODEM_PATH;
    if (modemPath) {
        const baudRate   = Number(process.env.SMS_MODEM_BAUD ?? 115200);
        const modemProvider = new GsmModemProvider(modemPath, baudRate);
        modemProvider.init()
            .then(() => {
                SmsService.getInstance().init(bank, modemProvider);
                logger.info(`[sms] modem active on ${modemPath}`);
            })
            .catch(err => {
                logger.warn(`[sms] modem unavailable on ${modemPath}: ${(err as Error).message}`);
                logger.warn("[sms] SMS banking disabled — fix the modem and restart");
            });
    } else {
        logger.info("[sms] SMS_MODEM_PATH not set — SMS banking disabled");
    }

    // ── Routes ──────────────────────────────────────────────────────────
    // Cluster routes sit outside the write guard — /status is always
    // readable and /snapshot is primary-gated internally.
    // Register inbound EcfMessage handlers
    MessageDispatcher.getInstance().register("mail.message.deliver",    handleInboundMail,            "async");
    MessageDispatcher.getInstance().register("bank.transfer.receive",   handleBankTransferReceive,    "sync");

    app.use("/api/cluster", clusterRoutes(communitySigner.publicKeyHex));
    app.use("/api",         cluster.replicaWriteGuard(), communityRoutes);
    app.use("/api/node",    networkRouter);
    app.use("/api/message", messageRouter);

    app.get("/health", (_req, res) => {
        const bankReady = CentralBank.getInstance().isReady();
        res.status(bankReady ? 200 : 206).json({
            status: bankReady ? "ok" : "degraded",
            bank: bankReady ? "connected" : "unreachable",
        });
    });

    app.get("/api/config", (_req, res) => {
        const PORT_NUM = Number(process.env.PORT ?? 3002);
        res.json({
            communityUrl: process.env.PUBLIC_COMMUNITY_URL ?? `http://localhost:${PORT_NUM}`,
            bankUrl:      process.env.PUBLIC_BANK_URL      ?? "http://localhost:3001",
            marketUrl:    process.env.PUBLIC_MARKET_URL    ?? "http://localhost:3003",
            mailUrl:      process.env.PUBLIC_MAIL_URL      ?? "http://localhost:3020",
            atheneumUrl:  process.env.PUBLIC_ATHENEUM_URL  ?? "http://localhost:3004",
            grangeUrl:    process.env.PUBLIC_GRANGE_URL    ?? "http://localhost:3005",
        });
    });

    // Expose the community's public key so federation / other nodes can verify credentials.
    // All replica nodes share communitySigner, so they all return the same publicKey.
    app.get("/api/identity", (_req, res) => {
        const identity = NodeService.getInstance().getIdentity();
        const handle   = Constitution.getInstance().communityHandle;
        res.json({ id: identity.id, entityId: identity.entityId, publicKey: communitySigner.publicKeyHex, name: identity.name, handle });
    });

    // Rich bootstrap info for a federation setting up this community as its founding member.
    // Superset of /api/identity — adds memberCount so the federation can set the credit line.
    app.get("/api/federation/bootstrap", (_req, res) => {
        const identity    = NodeService.getInstance().getIdentity();
        const handle      = Constitution.getInstance().communityHandle;
        const memberCount = PersonService.getInstance().getAll().length;
        res.json({
            nodeId:      identity.id,
            entityId:    identity.entityId,
            publicKey:   communitySigner.publicKeyHex,
            name:        identity.name,
            handle,
            url:         identity.address,
            memberCount,
        });
    });

    app.get("/api/constitution", (_req, res) => {
        res.json(Constitution.getInstance().toDocument());
    });

    // Serve frontend
    const publicDir = join(__dirname, "../public");
    app.use(express.static(publicDir));
    app.get("*splat", (_req, res) => {
        res.sendFile(join(publicDir, "index.html"));
    });

    app.listen(PORT, () => {
        logger.info(`[community] listening on port ${PORT} (bank: ${BANK_URL})`);
    });
}

main().catch(err => {
    logger.error({ err }, "[community] startup failed");
    process.exit(1);
});

// Library exports (for tests / consumers of the package)
export { Person } from "./person/Person.js";
export type { PersonCredential, LanguageProficiency } from "./person/Person.js";
export { PersonLoader } from "./person/PersonLoader.js";
export { PersonService } from "./person/PersonService.js";
export type { PersonPatch } from "./person/PersonService.js";
export { CommunityRole } from "./common/CommunityRole.js";
export { CommunityRoleLoader } from "./common/domain/CommunityRoleLoader.js";
export { FunctionalUnit } from "./common/domain/FunctionalUnit.js";
export { FunctionalDomain } from "./common/domain/FunctionalDomain.js";
export { FunctionalUnitLoader } from "./common/domain/FunctionalUnitLoader.js";
export { FunctionalDomainLoader } from "./common/domain/FunctionalDomainLoader.js";
export { UnitTemplateRegistry } from "./common/domain/UnitTemplateRegistry.js";
export { LeaderPool } from "./governance/LeaderPool.js";
export { LeaderPoolLoader } from "./governance/LeaderPoolLoader.js";
export { DomainService } from "./DomainService.js";
export { BankClient } from "@ecf/core";
