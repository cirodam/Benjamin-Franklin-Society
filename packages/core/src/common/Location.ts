import { randomUUID } from "crypto";

export class Location {
    readonly id: string;
    readonly createdAt: Date;

    name: string;
    address: string;
    lat: number | null;
    lng: number | null;
    description: string;

    constructor(
        name: string,
        address: string,
        lat: number | null = null,
        lng: number | null = null,
        description = "",
        id?: string,
        createdAt?: Date,
    ) {
        this.id          = id ?? randomUUID();
        this.createdAt   = createdAt ?? new Date();
        this.name        = name;
        this.address     = address;
        this.lat         = lat;
        this.lng         = lng;
        this.description = description;
    }
}
