// FederationMotion is the unified Motion class from @ecf/core.
// Federation motions use voterId = communityMemberId, voterHandle = communityHandle,
// proposerId = communityMemberId of the proposing community's delegate.
export { Motion as FederationMotion, type MotionData as FederationMotionData, type MotionOutcome as FederationMotionOutcome } from "@ecf/core";
export type { MotionStage } from "@ecf/core";
/** Extends the base MotionStage with federation clerk-body stages. */
export type FederationMotionStage = import("@ecf/core").MotionStage | "proposed" | "discussed";
export type FederationVoteThresholdKey = "thresholdSimpleMajority" | "thresholdSupermajority" | "thresholdNearConsensus" | "petition";
export type FederationMotionBody = "community" | "assembly" | string;

