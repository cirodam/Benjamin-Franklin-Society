import { randomUUID } from "crypto";

export interface RoleTypeData {
    id: string;
    title: string;
    description: string;
    defaultKinPerMonth: number;
    preferredUnitTypes?: string[];
    /** High-level category grouping, e.g. "Healthcare", "Skilled Trades". */
    category?: string;
    /** Bullet-point list of key duties for this role. */
    responsibilities?: string[];
    /** Required or recommended training, qualifications, and certifications. */
    qualifications?: string[];
}

/**
 * A role type is an entry in the community's role bank — a catalog of
 * occupational roles that functional units can draw from when staffing.
 * e.g. "Nurse", "Firefighter", "Teacher", "Doctor".
 *
 * Role types are the template; CommunityRole instances are the actual
 * slots within a specific unit that can be filled by members.
 */
export class RoleType {
    readonly id: string;
    title: string;
    description: string;
    defaultKinPerMonth: number;
    /** Unit types this role is most relevant to — used to sort the "From role type" dropdown. */
    preferredUnitTypes: string[];
    /** High-level category grouping, e.g. "Healthcare", "Skilled Trades". */
    category: string;
    /** Key duties for this role. */
    responsibilities: string[];
    /** Required or recommended training, qualifications, and certifications. */
    qualifications: string[];

    constructor(
        title: string,
        description: string = "",
        defaultKinPerMonth: number = 0,
        id?: string,
        preferredUnitTypes: string[] = [],
        category: string = "",
        responsibilities: string[] = [],
        qualifications: string[] = [],
    ) {
        this.id = id ?? randomUUID();
        this.title = title;
        this.description = description;
        this.defaultKinPerMonth = defaultKinPerMonth;
        this.preferredUnitTypes = preferredUnitTypes;
        this.category = category;
        this.responsibilities = responsibilities;
        this.qualifications = qualifications;
    }

    toData(): RoleTypeData {
        return {
            id:                 this.id,
            title:              this.title,
            description:        this.description,
            defaultKinPerMonth: this.defaultKinPerMonth,
            preferredUnitTypes: this.preferredUnitTypes,
            category:           this.category,
            responsibilities:   this.responsibilities,
            qualifications:     this.qualifications,
        };
    }

    static restore(data: RoleTypeData): RoleType {
        return new RoleType(
            data.title,
            data.description,
            data.defaultKinPerMonth,
            data.id,
            data.preferredUnitTypes ?? [],
            data.category ?? "",
            data.responsibilities ?? [],
            data.qualifications ?? [],
        );
    }
}
