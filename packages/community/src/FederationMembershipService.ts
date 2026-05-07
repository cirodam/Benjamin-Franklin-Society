import logger from "./logger.js";
import { NodeService, UpstreamMembershipService, type UpstreamApplicationStatus, sendMessage } from "@ecf/core";

export type FederationApplicationStatus = UpstreamApplicationStatus;

export interface FederationMembershipRecord {
    /** URL of the federation node, e.g. http://federation:3010 */
    federationUrl:         string;
    /** Application ID returned by the federation on submit */
    applicationId:         string;
    /** Set once the federation approves and creates the member record */
    memberId:              string | null;
    /** The account ID at the federation bank (set on approval) */
    federationAccountId:   string | null;
    /** The handle this community chose — its segment in the routable address */
    communityHandle:       string;
    /** The federation's own handle — fetched from federation identity on approval */
    federationHandle:      string | null;
    /** The commonwealth the federation belongs to — forwarded from federation identity */
    commonwealthHandle:    string | null;
    /** The globe the commonwealth belongs to — forwarded from federation identity */
    globeHandle:           string | null;
    /** URL of the commonwealth this federation belongs to (fetched on approval) */
    commonwealthUrl:       string | null;
    /** URL of the globe the commonwealth belongs to (fetched on approval) */
    globeUrl:              string | null;
    status:                FederationApplicationStatus;
    appliedAt:             string; // ISO 8601
}

export class FederationMembershipService extends UpstreamMembershipService<FederationMembershipRecord> {
    private static instance: FederationMembershipService;

    private constructor(dataDir: string) {
        super(dataDir, "federation_membership.json");
    }

    static getInstance(dataDir?: string): FederationMembershipService {
        if (!FederationMembershipService.instance) {
            if (!dataDir) throw new Error("FederationMembershipService: dataDir required on first call");
            FederationMembershipService.instance = new FederationMembershipService(dataDir);
        }
        return FederationMembershipService.instance;
    }

    // ── UpstreamMembershipService interface ──────────────────────────────────

    protected buildApplyBody(): Record<string, unknown> {
        // Not used directly — apply() constructs the body itself to include name + handle args
        return {};
    }

    protected upstreamUrl(): string {
        return this.record!.federationUrl;
    }

    protected async onApproved(base: string, memberId: string): Promise<void> {
        if (!this.record) return;

        if (!this.record.federationAccountId) {
            try {
                const res = await fetch(`${base}/api/members`);
                if (res.ok) {
                    const members = await res.json() as { id: string; bankAccountId: string | null }[];
                    const member  = members.find(m => m.id === memberId);
                    if (member?.bankAccountId) this.record.federationAccountId = member.bankAccountId;
                }
            } catch (err) {
                logger.warn(`[FederationMembershipService] onApproved: could not fetch /api/members: ${(err as Error).message}`);
            }
        }

        if (!this.record.federationHandle) {
            try {
                const res = await fetch(`${base}/api/identity`);
                if (res.ok) {
                    const id = await res.json() as {
                        handle?: string;
                        commonwealthHandle?: string;
                        globeHandle?: string;
                    };
                    if (id.handle)             this.record.federationHandle   = id.handle;
                    if (id.commonwealthHandle) this.record.commonwealthHandle = id.commonwealthHandle;
                    if (id.globeHandle)        this.record.globeHandle        = id.globeHandle;
                }
            } catch (err) {
                logger.warn(`[FederationMembershipService] onApproved: could not fetch /api/identity: ${(err as Error).message}`);
            }
        }

        if (!this.record.commonwealthUrl) {
            try {
                const res = await fetch(`${base}/api/membership-chain`);
                if (res.ok) {
                    const chain = await res.json() as {
                        commonwealthUrl:    string | null;
                        commonwealthHandle: string | null;
                        globeUrl:           string | null;
                        globeHandle:        string | null;
                    };
                    if (chain.commonwealthUrl)    this.record.commonwealthUrl    = chain.commonwealthUrl;
                    if (chain.commonwealthHandle) this.record.commonwealthHandle = chain.commonwealthHandle;
                    if (chain.globeUrl)           this.record.globeUrl           = chain.globeUrl;
                    if (chain.globeHandle)        this.record.globeHandle        = chain.globeHandle;
                }
            } catch (err) {
                logger.warn(`[FederationMembershipService] onApproved: could not fetch /api/membership-chain: ${(err as Error).message}`);
            }
        }
    }

    // ── Public API ───────────────────────────────────────────────────────────

    async apply(
        federationUrl:   string,
        communityName:   string,
        communityHandle: string,
    ): Promise<FederationMembershipRecord> {
        if (this.record && this.record.status !== "rejected") {
            throw new Error(
                `Already have a federation application in status "${this.record.status}"`,
            );
        }

        const node = NodeService.getInstance();
        const applyBody = {
            communityName,
            communityHandle,
            communityNodeId:    node.getIdentity().id,
            communityPublicKey: node.getSigner().publicKeyHex,
            communityUrl:       node.getIdentity().address,
            communityEntityId:  node.getIdentity().entityId,
        };
        const body      = JSON.stringify(applyBody);
        const signature = node.getSigner().signBody(body);
        const base      = federationUrl.replace(/\/$/, "");

        const res = await fetch(`${base}/api/applications`, {
            method:  "POST",
            headers: {
                "Content-Type":     "application/json",
                "x-node-signature": signature,
            },
            body,
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({})) as { error?: string };
            throw new Error(`Federation application failed (${res.status}): ${err.error ?? "unknown error"}`);
        }

        const data = await res.json() as { id: string; status: string };
        this.record = {
            federationUrl,
            applicationId:       data.id,
            memberId:            null,
            federationAccountId: null,
            communityHandle,
            federationHandle:    null,
            commonwealthHandle:  null,
            globeHandle:         null,
            commonwealthUrl:     null,
            globeUrl:            null,
            status:              data.status as FederationApplicationStatus,
            appliedAt:           new Date().toISOString(),
        };
        this.save();
        logger.info(`[FederationMembership] applied to ${federationUrl}: application ${data.id}`);
        return this.record;
    }

    /**
     * Register this community as the founding member of a federation, bypassing
     * the normal application flow.  Called when the federation operator configures
     * the federation via its setup UI and the federation node calls back here.
     *
     * Verifies the claim by querying `GET <federationUrl>/api/members` and
     * confirming this community's nodeId is listed as an `isFounder` member.
     */
    async register(
        federationUrl:   string,
        communityHandle: string,
        memberId:        string,
        bankAccountId:   string | null,
    ): Promise<FederationMembershipRecord> {
        if (this.record && this.record.status !== "rejected") {
            throw new Error(`Already have a federation membership in status "${this.record.status}"`);
        }

        const base    = federationUrl.replace(/\/$/, "");
        const nodeId  = NodeService.getInstance().getIdentity().id;

        // Verify: call back to the federation and confirm we're listed as a founder
        let membersData: { id: string; communityNodeId: string; isFounder: boolean; bankAccountId: string | null }[];
        try {
            const res = await fetch(`${base}/api/members`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            membersData = await res.json() as typeof membersData;
        } catch (err) {
            throw new Error(`Could not verify registration with federation: ${(err as Error).message}`);
        }

        const confirmed = membersData.find(m => m.communityNodeId === nodeId && m.isFounder);
        if (!confirmed) {
            throw new Error("Federation does not list this community as a founding member — registration refused");
        }

        this.record = {
            federationUrl:       base,
            applicationId:       memberId,
            memberId,
            federationAccountId: bankAccountId ?? confirmed.bankAccountId,
            communityHandle,
            federationHandle:    null,
            commonwealthHandle:  null,
            globeHandle:         null,
            commonwealthUrl:     null,
            globeUrl:            null,
            status:              "approved",
            appliedAt:           new Date().toISOString(),
        };
        this.save();

        // Fetch federation handle, commonwealth chain, etc.
        await this.onApproved(base, memberId);
        this.save();

        logger.info(`[FederationMembership] registered as founding member of ${federationUrl} (member ${memberId})`);
        return this.record;
    }

}
