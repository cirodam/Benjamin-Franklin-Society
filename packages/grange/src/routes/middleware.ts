import { requirePersonCredential, requireAppPermission } from "@ecf/core";
import { getCommunityIdentity } from "../communityIdentity.js";

/** Verifies a valid community-issued PersonCredential. */
export const requireAuth         = requirePersonCredential(getCommunityIdentity);

/** Requires `grange: admin` permission (Farmers pool coordinators). */
export const requireAdmin        = [requireAuth, requireAppPermission("grange", "admin")];

/** Base auth for standard grange routes. */
export const requireGrangeAccess = [requireAuth];
