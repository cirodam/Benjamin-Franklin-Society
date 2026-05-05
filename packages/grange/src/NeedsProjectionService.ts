import type { NeedsProjection, CropNeedEntry, PlantingWindow } from "./types.js";
import { NeedsProjectionLoader } from "./NeedsProjectionLoader.js";
import { randomUUID } from "crypto";

export class NeedsProjectionService {
    private static instance: NeedsProjectionService;
    private projections: Map<string, NeedsProjection> = new Map();
    private loader!: NeedsProjectionLoader;

    private constructor() {}

    static getInstance(): NeedsProjectionService {
        if (!NeedsProjectionService.instance) NeedsProjectionService.instance = new NeedsProjectionService();
        return NeedsProjectionService.instance;
    }

    init(loader: NeedsProjectionLoader): void {
        this.loader = loader;
        for (const p of loader.findAll()) this.projections.set(p.id, p);
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    get(id: string): NeedsProjection | undefined {
        return this.projections.get(id);
    }

    getAll(): NeedsProjection[] {
        return Array.from(this.projections.values())
            .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    }

    getByWindow(window: PlantingWindow): NeedsProjection | undefined {
        return this.getAll().find(p => p.plantingWindow === window);
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    publish(params: {
        plantingWindow:    PlantingWindow;
        memberHeadcount:   number;
        reserveTargetWeeks: number;
        cropNeeds:         Omit<CropNeedEntry, "id">[];
    }): NeedsProjection {
        const projection: NeedsProjection = {
            id:                 randomUUID(),
            plantingWindow:     params.plantingWindow,
            memberHeadcount:    params.memberHeadcount,
            reserveTargetWeeks: params.reserveTargetWeeks,
            cropNeeds:          params.cropNeeds.map(n => ({ ...n, id: randomUUID() })),
            publishedAt:        new Date().toISOString(),
            approvedByMotionId: null,
        };
        this.projections.set(projection.id, projection);
        this.loader.save(projection);
        return projection;
    }

    approve(id: string, motionId: string): NeedsProjection {
        const projection = this.projections.get(id);
        if (!projection) throw new Error(`Projection not found: ${id}`);
        projection.approvedByMotionId = motionId;
        this.loader.save(projection);
        return projection;
    }
}
