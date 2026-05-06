import { BaseLoader } from "@ecf/core";
import { FederationMotion, type FederationMotionData } from "./FederationMotion.js";

export class FederationMotionLoader extends BaseLoader<FederationMotionData, FederationMotion> {
    protected serialize(m: FederationMotion): FederationMotionData   { return m.toData(); }
    protected deserialize(d: FederationMotionData): FederationMotion { return FederationMotion.fromData(d); }
}

