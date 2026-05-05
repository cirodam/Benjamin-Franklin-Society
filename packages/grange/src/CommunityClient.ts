/**
 * Thin HTTP client for calling the community backend from the grange service.
 *
 * Used for:
 *   1. Looking up the Farmers pool ID (cached).
 *   2. Creating governance motions when contracts are submitted or projections published.
 */
export class CommunityClient {
    private static instance: CommunityClient;
    private farmersPoolId: string | null = null;

    private constructor() {}

    static getInstance(): CommunityClient {
        if (!CommunityClient.instance) CommunityClient.instance = new CommunityClient();
        return CommunityClient.instance;
    }

    private url(): string {
        return (process.env.COMMUNITY_URL ?? "http://localhost:3002").replace(/\/$/, "");
    }

    /** Returns the Farmers pool ID, fetching from community on first call. */
    async getFarmersPoolId(): Promise<string | null> {
        if (this.farmersPoolId) return this.farmersPoolId;
        try {
            const res = await fetch(`${this.url()}/api/pools`);
            if (!res.ok) return null;
            const pools = await res.json() as { id: string; name: string }[];
            const farmers = pools.find(p => p.name === "Farmers");
            this.farmersPoolId = farmers?.id ?? null;
        } catch (err) {
            console.error("[grange] CommunityClient.getFarmersPoolId failed:", err);
        }
        return this.farmersPoolId;
    }

    /**
     * Create a governance motion on the community backend.
     * The caller's Bearer token is forwarded so the motion is attributed to them.
     * Returns the new motion ID on success.
     */
    async createMotion(bearerToken: string, params: {
        title:       string;
        description: string;
        body:        string;
        parentId?:   string | null;
    }): Promise<string | null> {
        try {
            const res = await fetch(`${this.url()}/api/motions`, {
                method:  "POST",
                headers: {
                    "Content-Type":  "application/json",
                    "Authorization": `Bearer ${bearerToken}`,
                },
                body: JSON.stringify(params),
            });
            if (!res.ok) return null;
            const motion = await res.json() as { id: string };
            return motion.id ?? null;
        } catch (err) {
            console.error("[grange] CommunityClient.createMotion failed:", err);
            return null;
        }
    }
}
