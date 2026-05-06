import type { Motion } from "./Motion.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EffectContext {
    motion:  Motion;
    payload: Record<string, unknown>;
}

export type EffectHandler       = (ctx: EffectContext) => void;
export type PayloadValidator    = (raw: unknown) => string | null; // null = valid

export interface EffectDefinition {
    label:     string;          // human-readable, shown in UI
    bodyHint?: "referendum" | "assembly"; // advisory only — not enforced
    validate:  PayloadValidator;
    handler:   EffectHandler;
}

// ── Registry ──────────────────────────────────────────────────────────────────

class EffectRegistry {
    private defs = new Map<string, EffectDefinition>();

    register(kind: string, def: EffectDefinition): void {
        this.defs.set(kind, def);
    }

    getDefinition(kind: string): EffectDefinition | undefined {
        return this.defs.get(kind);
    }

    /** Returns all registered kinds for display in the UI. */
    listKinds(): { kind: string; label: string; bodyHint?: string }[] {
        return [...this.defs.entries()].map(([kind, def]) => ({
            kind,
            label:    def.label,
            bodyHint: def.bodyHint,
        }));
    }

    /**
     * Validate a payload object against the registered kind's validator.
     * Returns an error string, or null if valid.
     */
    validatePayload(kind: string, raw: unknown): string | null {
        const def = this.defs.get(kind);
        if (!def) return `Unknown effect kind "${kind}"`;
        return def.validate(raw);
    }

    /**
     * Dispatch the effect for a passed motion.
     * No-op if motion.kind is null or unset.
     * Throws if kind is set but no handler is registered, or if the handler fails.
     * Must be called before persisting the motion — if this throws, do not save.
     */
    dispatch(motion: Motion): void {
        if (!motion.kind) return;
        const def = this.defs.get(motion.kind);
        if (!def) throw new Error(`No handler registered for effect kind "${motion.kind}"`);
        const payload = JSON.parse(motion.payload ?? "{}") as Record<string, unknown>;
        def.handler({ motion, payload });
    }
}

export const effectRegistry = new EffectRegistry();
