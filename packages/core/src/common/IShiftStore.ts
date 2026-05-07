import type { Shift } from "./Shift.js";

export interface IShiftStore {
    save(shift: Shift): void;
    loadAll(): Shift[];
    delete(id: string): boolean;
}
