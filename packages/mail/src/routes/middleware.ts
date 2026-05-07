import { requirePersonCredential, requireAppPermission } from "@ecf/core";
import { getCommunityIdentity } from "../communityIdentity.js";

/** Verifies a valid community-issued PersonCredential. */
export const requireAuth       = requirePersonCredential(getCommunityIdentity);

/** Requires `mail: moderator` permission. */
export const requireModerator  = [requireAuth, requireAppPermission("mail", "moderator")];

/** Base auth for standard mail routes. */
export const requireMailAccess = [requireAuth];
