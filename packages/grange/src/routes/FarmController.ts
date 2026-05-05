import type { Request, Response } from "express";
import type { AuthedRequest } from "@ecf/core";
import { FarmAssociationService } from "../FarmAssociationService.js";
import { CommunityClient } from "../CommunityClient.js";
import type { PracticeDeclaration, FarmStatus } from "../types.js";

const svc = () => FarmAssociationService.getInstance();

export function listFarms(req: Request, res: Response): void {
    const { status } = req.query as Record<string, string | undefined>;
    let farms = svc().getAll();
    if (status) farms = farms.filter(f => f.status === status);
    res.json(farms);
}

export function getFarm(req: Request, res: Response): void {
    const farm = svc().get(req.params.id as string);
    if (!farm) { res.status(404).json({ error: "Farm not found" }); return; }
    res.json(farm);
}

export function registerFarm(req: Request, res: Response): void {
    const caller = req as AuthedRequest;
    const { name, location, acreage, practices } = req.body as {
        name: string; location: string; acreage: number; practices: PracticeDeclaration;
    };
    try {
        const farm = svc().register({
            name,
            homeCommunityId: caller.credential.communityNodeId ?? "",
            operatorIds:     [caller.personId],
            location,
            acreage,
            practices,
        });
        res.status(201).json(farm);
    } catch (err: unknown) {
        res.status(400).json({ error: (err as Error).message });
    }
}

export function updateFarmStatus(req: Request, res: Response): void {
    const { status, eligibilityMotionId } = req.body as { status: FarmStatus; eligibilityMotionId?: string };
    try {
        const farm = svc().setStatus(req.params.id as string, status as Parameters<ReturnType<typeof svc>["setStatus"]>[1], eligibilityMotionId);
        res.json(farm);
    } catch (err: unknown) {
        res.status(400).json({ error: (err as Error).message });
    }
}

export function updateFarmPractices(req: Request, res: Response): void {
    const { practices } = req.body as { practices: PracticeDeclaration };
    try {
        const farm = svc().updatePractices(req.params.id as string, practices);
        res.json(farm);
    } catch (err: unknown) {
        res.status(400).json({ error: (err as Error).message });
    }
}

export function approveFarm(req: Request, res: Response): void {
    const { motionId } = req.body as { motionId: string };

    // Fire-and-forget: create a motion in Farmers pool for the assembly
    const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "").trim();
    const farm = svc().get(req.params.id as string);
    if (!farm) { res.status(404).json({ error: "Farm not found" }); return; }

    if (token && !motionId) {
        CommunityClient.getInstance().getFarmersPoolId().then(poolId => {
            return CommunityClient.getInstance().createMotion(token, {
                title:       `Approve farm eligibility: ${farm.name}`,
                description: `Farm association registration from ${farm.location}.\n` +
                             `Acreage: ${farm.acreage}\nOperators: ${farm.operatorIds.length}`,
                body:        "grange",
                parentId:    poolId,
            });
        }).then(newMotionId => {
            if (newMotionId) {
                svc().setStatus(farm.id, "eligible", newMotionId);
                console.info(`[grange] created eligibility motion ${newMotionId} for farm ${farm.id}`);
            }
        }).catch(err => console.error("[grange] eligibility motion creation failed:", err));

        res.json({ status: "pending-motion" });
        return;
    }

    try {
        const updated = svc().setStatus(farm.id, "eligible", motionId);
        res.json(updated);
    } catch (err: unknown) {
        res.status(400).json({ error: (err as Error).message });
    }
}
