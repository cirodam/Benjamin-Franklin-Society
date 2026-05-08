import { Request, Response } from "express";
import { MotionService } from "../governance/MotionService.js";
import { effectRegistry } from "@ecf/core";
import { Motion } from "@ecf/core";
import { DocumentLoader } from "../governance/DocumentLoader.js";

const motionSvc = () => MotionService.getInstance();

function toMotionDto(m: Motion) {
    const data = m.toData();
    const { proposerId: _pid, ...rest } = data as typeof data & { proposerId?: unknown };
    return {
        ...rest,
        votes:    data.votes.map(({ voterId: _vpid, ...v }) => v),
        comments: data.comments.map(({ authorId: _acid, ...c }) => c),
    };
}

// POST /api/apply  (public — no auth required)
// Creates an add-person petition motion on behalf of the applicant.
// The motion's description carries the applicant's introduction message.
export function publicSubmitApplication(req: Request, res: Response): void {
    const { firstName, lastName, birthDate, message } = req.body ?? {};

    if (typeof firstName !== "string" || !firstName.trim()) {
        res.status(400).json({ error: "firstName is required" }); return;
    }
    if (typeof lastName !== "string" || !lastName.trim()) {
        res.status(400).json({ error: "lastName is required" }); return;
    }
    if (!birthDate || isNaN(new Date(birthDate).getTime())) {
        res.status(400).json({ error: "birthDate must be a valid date" }); return;
    }
    if (typeof message !== "string" || !message.trim()) {
        res.status(400).json({ error: "message is required" }); return;
    }

    const fn = firstName.trim();
    const ln = lastName.trim();

    const payloadErr = effectRegistry.validatePayload("add-person", { firstName: fn, lastName: ln, birthDate });
    if (payloadErr) { res.status(400).json({ error: payloadErr }); return; }

    const minApprovals = new DocumentLoader().getParam<number>("constitution", "memberAdmissionVouchesRequired");

    try {
        const motion = motionSvc().create({
            authorityId:    "community",
            title:          `Membership application: ${fn} ${ln}`,
            description:    message.trim(),
            proposerId:     "public",
            proposerHandle: "public application",
            kind:           "admit-member",
            payload:        JSON.stringify({ firstName: fn, lastName: ln, birthDate }),
        });

        motionSvc().submitForDeliberation(motion.id, "public", "petition", minApprovals);

        res.status(201).json(toMotionDto(motion));
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}
