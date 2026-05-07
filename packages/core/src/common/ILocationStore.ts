import type { Location } from "./Location.js";

export interface ILocationStore {
    save(loc: Location): void;
    loadAll(): Location[];
    delete(id: string): boolean;
}
