<script lang="ts">
    import { onMount } from "svelte";
    import { session } from "../lib/session.js";

    interface AppConfig {
        communityUrl:  string;
        bankUrl:       string;
        marketUrl:     string;
        mailUrl:       string;
        atheneumUrl:   string;
        grangeUrl:     string;
    }

    let config = $state<AppConfig | null>(null);
    let open   = $state(false);
    let wrap: HTMLElement | null = $state(null);

    onMount(async () => {
        try {
            config = await fetch("/api/config").then(r => r.json()) as AppConfig;
        } catch { /* silent */ }
    });

    $effect(() => {
        if (!open) return;
        function handleClick(e: MouseEvent) {
            if (wrap && !wrap.contains(e.target as Node)) open = false;
        }
        document.addEventListener("click", handleClick, { capture: true });
        return () => document.removeEventListener("click", handleClick, { capture: true });
    });

    function sessionHash(): string {
        if (!$session) return "";
        const payload = btoa(JSON.stringify({
            token:     $session.token,
            id:        $session.personId,
            firstName: $session.firstName,
            lastName:  $session.lastName,
            handle:    $session.handle,
        }));
        return `#session=${payload}`;
    }

    const apps = $derived(config ? [
        { id: "community", label: "Community", icon: "⊚", url: config.communityUrl },
        { id: "bank",      label: "Bank",      icon: "◈", url: config.bankUrl },
        { id: "market",    label: "Market",    icon: "⊕", url: config.marketUrl },
        { id: "mail",      label: "Mail",      icon: "✉", url: config.mailUrl },
        { id: "atheneum",  label: "Atheneum",  icon: "⊘", url: config.atheneumUrl },
        { id: "grange",    label: "Grange",    icon: "⊛", url: config.grangeUrl, current: true },
    ] : []);
</script>

{#if config}
    <div class="switcher-wrap" bind:this={wrap}>
        <button
            class="trigger"
            class:open
            onclick={() => open = !open}
            title="Switch app"
            aria-haspopup="true"
            aria-expanded={open}
        >⊞</button>

        {#if open}
            <div class="dropdown" role="menu">
                {#each apps as app (app.id)}
                    {#if app.current}
                        <span class="app-item current" role="menuitem" aria-current="true">
                            <span class="app-icon">{app.icon}</span>
                            <span class="app-name">{app.label}</span>
                        </span>
                    {:else}
                        <a
                            class="app-item"
                            href="{app.url}{sessionHash()}"
                            role="menuitem"
                            rel="noopener"
                            onclick={() => open = false}
                        >
                            <span class="app-icon">{app.icon}</span>
                            <span class="app-name">{app.label}</span>
                        </a>
                    {/if}
                {/each}
            </div>
        {/if}
    </div>
{/if}

<style>
    .switcher-wrap { position: relative; }

    .trigger {
        display: flex; align-items: center; justify-content: center;
        width: 2rem; height: 2rem; border-radius: 6px; border: none;
        background: none; cursor: pointer; font-size: 1.15rem; color: #94a3b8;
        transition: background 0.1s, color 0.1s;
    }
    .trigger:hover, .trigger.open { background: #334155; color: #e2e8f0; }

    .dropdown {
        position: absolute; left: calc(100% + 0.5rem); top: 0;
        background: #1e293b; border: 1px solid #334155; border-radius: 10px;
        padding: 0.4rem; min-width: 160px; z-index: 100;
        box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        display: flex; flex-direction: column; gap: 0.15rem;
    }

    .app-item {
        display: flex; align-items: center; gap: 0.6rem;
        padding: 0.5rem 0.75rem; border-radius: 6px;
        text-decoration: none; color: #cbd5e1; font-size: 0.9rem;
        transition: background 0.1s;
    }
    .app-item:hover { background: #334155; color: #f1f5f9; }
    .app-item.current { color: #64748b; cursor: default; }
    .app-item.current:hover { background: none; }

    .app-icon { font-size: 1rem; width: 1.2rem; text-align: center; }
    .app-name  { font-weight: 500; }
</style>
