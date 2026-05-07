/**
 * Community-wide handle namespace.
 *
 * Person and association handles share one flat namespace
 * per community so that any handle resolves unambiguously to a single entity.
 * Each service registers its handles here on init and checks availability
 * before creating new entities.
 */
export class HandleRegistry {
    private static instance: HandleRegistry;

    /** handle → { type, id } */
    private registry: Map<string, { type: "person" | "association"; id: string }> = new Map();

    private constructor() {}

    static getInstance(): HandleRegistry {
        if (!HandleRegistry.instance) HandleRegistry.instance = new HandleRegistry();
        return HandleRegistry.instance;
    }

    /** Returns true when the handle is already registered to any entity type. */
    isTaken(handle: string): boolean {
        return this.registry.has(handle);
    }

    /** Register a handle. Throws if already taken by a different id. */
    register(handle: string, type: "person" | "association", id: string): void {
        const existing = this.registry.get(handle);
        if (existing && existing.id !== id) {
            throw new Error(`Handle "${handle}" is already taken`);
        }
        this.registry.set(handle, { type, id });
    }

    /** Remove a handle registration (on discharge / dissolution). */
    release(handle: string): void {
        this.registry.delete(handle);
    }

    /** Look up who owns a handle. */
    resolve(handle: string): { type: "person" | "association"; id: string } | undefined {
        return this.registry.get(handle);
    }
}
