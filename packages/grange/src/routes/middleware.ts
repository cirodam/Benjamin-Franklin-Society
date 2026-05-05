import { requirePersonCredential, requireAppPermission, AppSuspensionCache, requireNotAppSuspended } from "@ecf/core";
import { getCommunityIdentity } from "../communityIdentity.js";

const COMMUNITY_URL   = process.env.COMMUNITY_URL ?? "http://localhost:3002";
const suspensionCache = new AppSuspensionCache(COMMUNITY_URL);

/** Verifies a valid community-issued PersonCredential. */
export const requireAuth           = requirePersonCredential(getCommunityIdentity);
export const requireNotSuspended   = requireNotAppSuspended("grange", suspensionCache);

/** Requires `grange: steward` permission (Farmers pool coordinators, Food Security stewards). */
export const requireSteward        = [requireAuth, requireNotSuspended, requireAppPermission("grange", "steward")];

/** Base auth + suspension check for standard grange routes. */
export const requireGrangeAccess   = [requireAuth, requireNotSuspended];
