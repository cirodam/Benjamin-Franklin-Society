import { requirePersonCredential, requireAppPermission } from "@ecf/core";
import { getCommunityIdentity } from "../communityIdentity.js";

/** Verifies a valid community-issued PersonCredential. */
export const requireAuth         = requirePersonCredential(getCommunityIdentity);

/** Requires `grange: steward` permission (Farmers pool coordinators, Food Security stewards). */
export const requireSteward      = [requireAuth, requireAppPermission("grange", "steward")];

/** Base auth for standard grange routes. */
export const requireGrangeAccess = [requireAuth];
