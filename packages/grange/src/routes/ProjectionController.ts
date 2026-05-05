import type { Request, Response } from "express";
import type { AuthedRequest } from "@ecf/core";
import { NeedsProjectionService } from "../NeedsProjectionService.js";
import { ContractService } from "../ContractService.js";
import { CommunityClient } from "../CommunityClient.js";
import type { CropNeedEntry, PlantingWindow } from "../types.js";

const svc     = () => NeedsProjectionService.getInstance();
const ctrSvc  = () => ContractService.getInstance();

export function listProjections(req: Request, res: Response): void {
    res.json(svc().getAll());
}

export function getProjection(req: Request, res: Response): void {
    const p = svc().get(req.params.id as string);
    if (!p) { res.status(404).json({ error: "Projection not found" }); return; }
    res.json(p);
}

export function getProjectionCoverage(req: Request, res: Response): void {
    const p = svc().get(req.params.id as string);
    if (!p) { res.status(404).json({ error: "Projection not found" }); return; }

    const cropNeedMap: Record<string, { crop: string; maxContractLbs: number; minDesiredLbs: number }> = {};
    for (const n of p.cropNeeds) {
        cropNeedMap[n.id] = { crop: n.crop, maxContractLbs: n.maxContractLbs, minDesiredLbs: n.minDesiredLbs };
    }

    res.json(ctrSvc().computeCoverage(p.id, cropNeedMap));
}

export function publishProjection(req: Request, res: Response): void {
    const { plantingWindow, memberHeadcount, reserveTargetWeeks, cropNeeds } = req.body as {
        plantingWindow:     PlantingWindow;
        memberHeadcount:    number;
        reserveTargetWeeks: number;
        cropNeeds:          Omit<CropNeedEntry, "id">[];
    };
    try {
        const projection = svc().publish({ plantingWindow, memberHeadcount, reserveTargetWeeks, cropNeeds });

        // Fire-and-forget: create a motion in Farmers pool to approve the projection
        const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "").trim();
        if (token) {
            const caller = req as AuthedRequest;
            void caller; // used for token only
            CommunityClient.getInstance().getFarmersPoolId().then(poolId => {
                const cropList = projection.cropNeeds
                    .map(n => `- ${n.crop}: up to ${n.maxContractLbs.toLocaleString()} lbs (floor ${n.minDesiredLbs.toLocaleString()} lbs) @ ${n.estimatedPaymentPerLbKin} kin/lb`)
                    .join("\n");
                return CommunityClient.getInstance().createMotion(token, {
                    title:       `Approve needs projection: ${projection.plantingWindow}`,
                    description: `Headcount: ${projection.memberHeadcount} — Reserve target: ${projection.reserveTargetWeeks} weeks\n\n${cropList}`,
                    body:        "grange",
                    parentId:    poolId,
                });
            }).then(motionId => {
                if (motionId) {
                    svc().approve(projection.id, motionId);
                    console.info(`[grange] created approval motion ${motionId} for projection ${projection.id}`);
                }
            }).catch(err => console.error("[grange] projection motion creation failed:", err));
        }

        res.status(201).json(projection);
    } catch (err: unknown) {
        res.status(400).json({ error: (err as Error).message });
    }
}

export function approveProjection(req: Request, res: Response): void {
    const { motionId } = req.body as { motionId: string };
    try {
        const projection = svc().approve(req.params.id as string, motionId);
        res.json(projection);
    } catch (err: unknown) {
        res.status(400).json({ error: (err as Error).message });
    }
}
