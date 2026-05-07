import { requirePersonCredential, requireAppPermission } from "@ecf/core";
import { getCommunityIdentity } from "../communityIdentity.js";

/** Verifies a valid community-issued PersonCredential. */
export const requireAuth         = requirePersonCredential(getCommunityIdentity);

/** Requires `market: coordinator` permission. */
export const requireCoordinator  = [requireAuth, requireAppPermission("market", "coordinator")];

/** Requires `market: admin` permission. */
export const requireMarketAdmin  = [requireAuth, requireAppPermission("market", "admin")];

/** Base auth — use this for standard market routes. */
export const requireMarketAccess = [requireAuth];
