import { requirePersonCredential, requireAppPermission } from "@ecf/core";
import { getCommunityIdentity } from "../communityIdentity.js";

/** Verifies a valid community-issued PersonCredential. */
export const requireAuth           = requirePersonCredential(getCommunityIdentity);

/** Requires `atheneum: coordinator` permission. */
export const requireCoordinator    = [requireAuth, requireAppPermission("atheneum", "coordinator")];

/** Base auth for standard atheneum routes. */
export const requireAtheneumAccess = [requireAuth];
