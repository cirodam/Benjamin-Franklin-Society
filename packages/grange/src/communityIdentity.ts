import { createCommunityIdentityCache } from "@ecf/core";

export const { setCommunityIdentity, getCommunityIdentity } =
    createCommunityIdentityCache("grange");
