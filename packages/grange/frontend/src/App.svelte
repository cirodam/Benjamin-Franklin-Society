<script lang="ts">
    import { onMount } from "svelte";
    import { session } from "./lib/session.js";
    import type { SessionData } from "./lib/session.js";
    import { currentPage } from "./lib/nav.js";
    import AppSwitcher from "./components/AppSwitcher.svelte";
    import DashboardPage from "./pages/DashboardPage.svelte";
    import ProjectionsPage from "./pages/ProjectionsPage.svelte";
    import ProjectionDetailPage from "./pages/ProjectionDetailPage.svelte";
    import FarmsPage from "./pages/FarmsPage.svelte";
    import FarmDetailPage from "./pages/FarmDetailPage.svelte";
    import ContractsPage from "./pages/ContractsPage.svelte";
    import ContractDetailPage from "./pages/ContractDetailPage.svelte";
    import NewProjectionPage from "./pages/NewProjectionPage.svelte";
    import NewContractOfferPage from "./pages/NewContractOfferPage.svelte";

    let ready = $state(false);

    onMount(async () => {
        const hash = window.location.hash;
        if (hash.startsWith("#session=")) {
            try {
                const raw     = decodeURIComponent(atob(hash.slice("#session=".length)));
                const payload = JSON.parse(raw) as { token: string; id: string; firstName: string; lastName: string; handle: string };
                let appPermissions: Record<string, string[]> = {};
                try {
                    const credJson = atob(payload.token.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.token.length / 4) * 4, "="));
                    const cred = JSON.parse(credJson) as { appPermissions?: Record<string, string[]> };
                    appPermissions = cred.appPermissions ?? {};
                } catch { /* no elevated perms */ }
                const data: SessionData = {
                    personId:  payload.id,
                    firstName: payload.firstName,
                    lastName:  payload.lastName,
                    handle:    payload.handle,
                    token:     payload.token,
                    appPermissions,
                };
                session.logout();
                session.login(data);
                history.replaceState(null, "", window.location.pathname + window.location.search);
            } catch {
                // Malformed fragment — fall through to redirect
            }
        }

        if (!$session) {
            const cfg = await fetch("/api/config").then(r => r.json()).catch(() => ({ communityUrl: "" })) as { communityUrl: string };
            const communityUrl = cfg.communityUrl || "http://localhost:3002";
            const returnUrl    = encodeURIComponent(window.location.origin);
            window.location.href = `${communityUrl}/login?return=${returnUrl}`;
            return;
        }

        ready = true;
    });

    $effect(() => {
        if ($session) {
            ready = true;
        } else if (ready) {
            ready = false;
            fetch("/api/config").then(r => r.json()).catch(() => ({ communityUrl: "" })).then((cfg: { communityUrl?: string }) => {
                const communityUrl = cfg.communityUrl || "http://localhost:3002";
                const returnUrl = encodeURIComponent(window.location.origin);
                window.location.href = `${communityUrl}/login?return=${returnUrl}`;
            });
        }
    });
</script>

{#if ready && $session}
<div class="app">
    <nav class="sidebar">
        <div class="nav-logo-row">
                <span class="nav-logo">⊛ Grange</span>
                <AppSwitcher />
            </div>
        <ul>
            <li class:active={$currentPage === "dashboard"}>
                <button onclick={() => currentPage.set("dashboard")}>Dashboard</button>
            </li>
            <li class:active={$currentPage === "projections"}>
                <button onclick={() => currentPage.set("projections")}>Needs Projections</button>
            </li>
            <li class:active={$currentPage === "farms"}>
                <button onclick={() => currentPage.set("farms")}>Farm Associations</button>
            </li>
            <li class:active={$currentPage === "contracts"}>
                <button onclick={() => currentPage.set("contracts")}>Contracts</button>
            </li>
        </ul>
        <div class="nav-footer">
            <span class="handle">@{$session.handle}</span>
            <button class="logout" onclick={() => session.logout()}>Sign out</button>
        </div>
    </nav>

    <main class="content">
        {#if $currentPage === "dashboard"}
            <DashboardPage />
        {:else if $currentPage === "projections"}
            <ProjectionsPage />
        {:else if $currentPage === "projection-detail"}
            <ProjectionDetailPage />
        {:else if $currentPage === "new-projection"}
            <NewProjectionPage />
        {:else if $currentPage === "new-contract-offer"}
            <NewContractOfferPage />
        {:else if $currentPage === "farms"}
            <FarmsPage />
        {:else if $currentPage === "farm-detail"}
            <FarmDetailPage />
        {:else if $currentPage === "contracts"}
            <ContractsPage />
        {:else if $currentPage === "contract-detail"}
            <ContractDetailPage />
        {/if}
    </main>
</div>
{/if}

<style>
    :global(*, *::before, *::after) { box-sizing: border-box; margin: 0; padding: 0; }
    :global(body) { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; height: 100vh; }

    .app {
        display: flex;
        height: 100vh;
    }

    .sidebar {
        width: 220px;
        background: #1e293b;
        display: flex;
        flex-direction: column;
        padding: 1.5rem 1rem;
        gap: 1.5rem;
        flex-shrink: 0;
    }

    .nav-logo-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .nav-logo {
        font-size: 1.15rem;
        font-weight: 700;
        color: #f1f5f9;
        letter-spacing: 0.02em;
    }

    ul {
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        flex: 1;
    }

    li button {
        width: 100%;
        text-align: left;
        background: none;
        border: none;
        color: #94a3b8;
        padding: 0.5rem 0.75rem;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.9rem;
    }

    li.active button, li button:hover {
        background: #334155;
        color: #f1f5f9;
    }

    .nav-footer {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .handle {
        font-size: 0.8rem;
        color: #64748b;
    }

    .logout {
        background: none;
        border: 1px solid #334155;
        color: #94a3b8;
        padding: 0.4rem 0.75rem;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.8rem;
    }

    .logout:hover {
        background: #334155;
        color: #f1f5f9;
    }

    .content {
        flex: 1;
        overflow-y: auto;
        padding: 2rem;
    }

    .placeholder p {
        color: #64748b;
    }
</style>
