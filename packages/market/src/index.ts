import express from "express";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
import { initServiceNode, resolveCommunityIdentity, networkRouter, messageRouter } from "@ecf/core";
import { MarketDb } from "./MarketDb.js";
import { ClassifiedLoader } from "./ClassifiedLoader.js";
import { ClassifiedService } from "./ClassifiedService.js";
import { StallLoader } from "./StallLoader.js";
import { StallService } from "./StallService.js";
import { ServiceProfileLoader } from "./ServiceProfileLoader.js";
import { ServiceProfileService } from "./ServiceProfileService.js";
import { MarketplaceLoader } from "./MarketplaceLoader.js";
import { MarketplaceService } from "./MarketplaceService.js";
import { setCommunityIdentity } from "./communityIdentity.js";
import marketRoutes from "./routes/marketRoutes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT          = Number(process.env.PORT          ?? 3003);
const DATA_DIR      = process.env.DATA_DIR              ?? join(__dirname, "../../data");
const BANK_URL      = process.env.BANK_URL              ?? "http://localhost:3001";
const COMMUNITY_URL = process.env.COMMUNITY_URL         ?? "http://localhost:3002";

const app = express();

app.use(express.json({
    verify: (req, _res, buf) => {
        (req as typeof req & { rawBody: string }).rawBody = buf.toString("utf-8");
    },
}));

async function main(): Promise<void> {
    await initServiceNode({
        name:         "market",
        port:         PORT,
        dataDir:      resolve(DATA_DIR),
        communityUrl: COMMUNITY_URL,
        seeds:        process.env.BOOTSTRAP_PEERS,
    });

    MarketDb.init(resolve(DATA_DIR));

    // Classifieds
    const classifiedLoader = new ClassifiedLoader();
    ClassifiedService.getInstance().init(classifiedLoader);

    // Expire stale listings once at startup, then every 24 hours.
    const runExpiryCheck = (): void => {
        const expired = ClassifiedService.getInstance().expireClassifieds();
        if (expired > 0) console.info(`[market] expired ${expired} classified listing(s)`);
    };
    runExpiryCheck();
    setInterval(runExpiryCheck, 24 * 60 * 60 * 1000);

    // Stalls
    const stallLoader = new StallLoader();
    StallService.getInstance().init(stallLoader);

    // Services
    const serviceProfileLoader = new ServiceProfileLoader();
    ServiceProfileService.getInstance().init(serviceProfileLoader);

    // Expire stale service profiles once at startup, then every 24 hours.
    const runServiceExpiryCheck = (): void => {
        const expired = ServiceProfileService.getInstance().expireServices();
        if (expired > 0) console.info(`[market] expired ${expired} service profile(s)`);
    };
    runServiceExpiryCheck();
    setInterval(runServiceExpiryCheck, 24 * 60 * 60 * 1000);

    // Marketplaces
    const marketplaceLoader = new MarketplaceLoader();
    MarketplaceService.getInstance().init(marketplaceLoader);

    // Resolve community identity non-blocking — public endpoints work immediately
    resolveCommunityIdentity(COMMUNITY_URL, "[market]")
        .then(id => setCommunityIdentity(id.nodeId, id.publicKey))
        .catch(err => console.error("[market] community identity resolution failed:", err));

    app.use("/api",      marketRoutes);
    app.use("/api/node",    networkRouter);
    app.use("/api/message", messageRouter);

    app.get("/health", (_req, res) => {
        res.json({
            status:      "ok",
            bankUrl:     BANK_URL,
            classifieds: ClassifiedService.getInstance().getAll().length,
            stalls:      StallService.getInstance().getAll().length,
            services:    ServiceProfileService.getInstance().getAll().length,
            marketplaces: MarketplaceService.getInstance().getAll().length,
        });
    });

    app.get("/api/config", (_req, res) => {
        res.json({
            communityUrl: process.env.PUBLIC_COMMUNITY_URL ?? COMMUNITY_URL,
            bankUrl:      process.env.PUBLIC_BANK_URL      ?? "http://localhost:3001",
            marketUrl:    process.env.PUBLIC_MARKET_URL    ?? `http://localhost:${PORT}`,
            mailUrl:      process.env.PUBLIC_MAIL_URL      ?? "http://localhost:3020",
            atheneumUrl:  process.env.PUBLIC_ATHENEUM_URL  ?? "http://localhost:3004",
            grangeUrl:    process.env.PUBLIC_GRANGE_URL    ?? "http://localhost:3005",
        });
    });

    // Serve frontend
    const publicDir = join(__dirname, "../public");
    app.use(express.static(publicDir));
    app.get("*splat", (_req, res) => {
        res.sendFile(join(publicDir, "index.html"));
    });

    app.listen(PORT, () => {
        console.log(`[market] listening on port ${PORT} (bank: ${BANK_URL}, community: ${COMMUNITY_URL})`);
    });
}

main().catch(err => {
    console.error("[market] startup failed:", err);
    process.exit(1);
});
