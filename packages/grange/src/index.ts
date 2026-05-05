import express from "express";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
import { initServiceNode, resolveCommunityIdentity, networkRouter, messageRouter } from "@ecf/core";
import { GrangeDb } from "./GrangeDb.js";
import { setCommunityIdentity } from "./communityIdentity.js";
import { FarmAssociationLoader } from "./FarmAssociationLoader.js";
import { FarmAssociationService } from "./FarmAssociationService.js";
import { NeedsProjectionLoader } from "./NeedsProjectionLoader.js";
import { NeedsProjectionService } from "./NeedsProjectionService.js";
import { ContractLoader } from "./ContractLoader.js";
import { ContractService } from "./ContractService.js";
import grangeRoutes from "./routes/grangeRoutes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT          = Number(process.env.PORT          ?? 3005);
const DATA_DIR      = process.env.DATA_DIR              ?? join(__dirname, "../../data");
const COMMUNITY_URL = process.env.COMMUNITY_URL         ?? "http://localhost:3002";

const PUBLIC_COMMUNITY_URL  = process.env.PUBLIC_COMMUNITY_URL  ?? "http://localhost:3002";
const PUBLIC_BANK_URL       = process.env.PUBLIC_BANK_URL       ?? "http://localhost:3001";
const PUBLIC_MARKET_URL     = process.env.PUBLIC_MARKET_URL     ?? "http://localhost:3003";
const PUBLIC_MAIL_URL       = process.env.PUBLIC_MAIL_URL       ?? "http://localhost:3020";
const PUBLIC_ATHENEUM_URL   = process.env.PUBLIC_ATHENEUM_URL   ?? "http://localhost:3004";
const PUBLIC_GRANGE_URL     = process.env.PUBLIC_GRANGE_URL     ?? "http://localhost:3005";

const app = express();

app.use(express.json({
    verify: (req, _res, buf) => {
        (req as typeof req & { rawBody: string }).rawBody = buf.toString("utf-8");
    },
}));

async function main(): Promise<void> {
    await initServiceNode({
        name:         "grange",
        port:         PORT,
        dataDir:      resolve(DATA_DIR),
        communityUrl: COMMUNITY_URL,
        seeds:        process.env.BOOTSTRAP_PEERS,
    });

    GrangeDb.init(resolve(DATA_DIR));

    FarmAssociationService.getInstance().init(new FarmAssociationLoader());
    NeedsProjectionService.getInstance().init(new NeedsProjectionLoader());
    ContractService.getInstance().init(new ContractLoader());

    resolveCommunityIdentity(COMMUNITY_URL, "[grange]")
        .then(id => setCommunityIdentity(id.nodeId, id.publicKey))
        .catch(err => console.error("[grange] community identity resolution failed:", err));

    app.use("/api", grangeRoutes);
    app.use("/api", networkRouter);
    app.use("/api", messageRouter);

    app.get("/api/config", (_req, res) => {
        res.json({
            communityUrl:  PUBLIC_COMMUNITY_URL,
            bankUrl:       PUBLIC_BANK_URL,
            marketUrl:     PUBLIC_MARKET_URL,
            mailUrl:       PUBLIC_MAIL_URL,
            atheneumUrl:   PUBLIC_ATHENEUM_URL,
            grangeUrl:     PUBLIC_GRANGE_URL,
        });
    });

    const publicDir = resolve(__dirname, "../../grange/public");
    app.use(express.static(publicDir));
    app.get("*splat", (_req, res) => {
        res.sendFile(join(publicDir, "index.html"));
    });

    app.listen(PORT, () => {
        console.log(`[grange] listening on port ${PORT}`);
    });
}

main().catch(err => {
    console.error("[grange] fatal error:", err);
    process.exit(1);
});
