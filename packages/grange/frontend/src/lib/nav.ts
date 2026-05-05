import { writable } from "svelte/store";

export type Page =
    | "dashboard"
    | "projections"
    | "projection-detail"
    | "new-projection"
    | "farms"
    | "farm-detail"
    | "contracts"
    | "contract-detail"
    | "new-contract-offer";

export const currentPage          = writable<Page>("dashboard");
export const selectedProjectionId = writable<string | null>(null);
export const selectedFarmId       = writable<string | null>(null);
export const selectedContractId   = writable<string | null>(null);
// Pre-selected projection when navigating directly to new-contract-offer
export const offerProjectionId    = writable<string | null>(null);
