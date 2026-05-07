import { Location } from "./Location.js";
import type { ILocationStore } from "./ILocationStore.js";

export class LocationService {
    private static instance: LocationService;
    private locations: Map<string, Location> = new Map();
    private store: ILocationStore | null = null;

    private constructor() {}

    static getInstance(): LocationService {
        if (!LocationService.instance) LocationService.instance = new LocationService();
        return LocationService.instance;
    }

    init(store: ILocationStore): void {
        this.store = store;
        for (const loc of store.loadAll()) {
            this.locations.set(loc.id, loc);
        }
    }

    getAll(): Location[] { return Array.from(this.locations.values()); }

    get(id: string): Location | undefined { return this.locations.get(id); }

    create(loc: Location): void {
        this.locations.set(loc.id, loc);
        this.store?.save(loc);
    }

    update(id: string, patch: { name?: string; address?: string; lat?: number | null; lng?: number | null; description?: string }): Location | null {
        const loc = this.locations.get(id);
        if (!loc) return null;
        if (patch.name        !== undefined) loc.name        = patch.name;
        if (patch.address     !== undefined) loc.address     = patch.address;
        if (patch.lat         !== undefined) loc.lat         = patch.lat;
        if (patch.lng         !== undefined) loc.lng         = patch.lng;
        if (patch.description !== undefined) loc.description = patch.description;
        this.store?.save(loc);
        return loc;
    }

    delete(id: string): boolean {
        if (!this.locations.has(id)) return false;
        this.locations.delete(id);
        this.store?.delete(id);
        return true;
    }
}
