import { requirePersonCredential, requireAppPermission } from "@ecf/core";
import { getCommunityIdentity } from "../communityIdentity.js";

/** Verifies a valid community-issued PersonCredential. */
export const requireAuth      = requirePersonCredential(getCommunityIdentity);

/** Requires `bank: teller` permission. */
export const requireTeller    = [requireAuth, requireAppPermission("bank", "teller")];

/** Requires `bank: admin` permission. */
export const requireBankAdmin = [requireAuth, requireAppPermission("bank", "admin")];

/** Base auth — use this for standard bank routes. */
export const requireBankAccess = [requireAuth];
