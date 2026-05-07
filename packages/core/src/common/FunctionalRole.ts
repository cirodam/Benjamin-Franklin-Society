import { randomUUID } from "crypto";

/** A recurring weekly time block attached to a role. */
export interface ScheduleSlot {
    /** 0 = Sunday, 1 = Monday … 6 = Saturday */
    dayOfWeek: number;
    /** "HH:MM" 24-hour local time */
    startTime: string;
    /** "HH:MM" 24-hour local time */
    endTime: string;
}

export class FunctionalRole {
    readonly id: string;
    title: string;
    description: string;
    /** ID of the RoleType (bank entry) this slot was created from. Null for ad-hoc roles. */
    roleTypeId: string | null;
    memberId: string | null;
    termStartDate: Date | null;
    termEndDate: Date | null;
    kinPerMonth: number;
    funded: boolean;
    weeklySchedule: ScheduleSlot[];

    constructor(title: string, description: string = "", kinPerMonth: number = 0, roleTypeId: string | null = null) {
        this.id = randomUUID();
        this.title = title;
        this.description = description;
        this.roleTypeId = roleTypeId;
        this.kinPerMonth = kinPerMonth;
        this.memberId = null;
        this.termStartDate = null;
        this.termEndDate = null;
        this.funded = kinPerMonth > 0;
        this.weeklySchedule = [];
    }

    isActive(): boolean {
        if (!this.memberId) return false;
        if (!this.funded) return false;
        const now = new Date();
        if (this.termStartDate && now < this.termStartDate) return false;
        if (this.termEndDate && now > this.termEndDate) return false;
        return true;
    }
}
