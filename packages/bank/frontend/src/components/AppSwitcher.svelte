<!--
    AppSwitcher — opens a dropdown to switch between ECF apps with session passthrough.
-->
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
        } catch { /* silent — switcher won't render */ }
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
            firstName: $session.displayName.split(" ")[0] ?? "",
            lastName:  $session.displayName.split(" ").slice(1).join(" ") ?? "",
            handle:    $session.handle,
        }));
        return `#session=${payload}`;
    }

    const apps = $derived(config ? [
        { id: "community", label: "Community", icon: "⊚", url: config.communityUrl },
        { id: "bank",      label: "Bank",      icon: "◈", url: config.bankUrl,       current: true },
        { id: "market",    label: "Market",    icon: "⊕", url: config.marketUrl },
        { id: "mail",      label: "Mail",      icon: "✉", url: config.mailUrl },
        { id: "atheneum",  label: "Atheneum",  icon: "⊘", url: config.atheneumUrl },
        { id: "grange",    label: "Grange",    icon: "⊛", url: config.grangeUrl },
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
    .switcher-wrap {
        position: relative;
    }

    .trigger {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        border-radius: 6px;
        border: none;
        background: none;
        cursor: pointer;
        font-size: 1.15rem;
        color: #64748b;
        transition: background 0.1s, color 0.1s;
    }

    .trigger:hover,
    .trigger.open {
        background: #eff6ff;
        color: #2563eb;
    }

    .dropdown {
        position: absolute;
        top: 0;
        left: calc(100% + 0.4rem);
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.10);
        min-width: 11rem;
        padding: 0.35rem 0;
        z-index: 300;
    }

    .app-item {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        padding: 0.5rem 1rem;
        text-decoration: none;
        color: #1e293b;
        font-size: 0.875rem;
        font-weight: 500;
        transition: background 0.1s;
        white-space: nowrap;
    }

    a.app-item:hover {
        background: #f8fafc;
        color: #0f172a;
    }

    span.app-item.current {
        color: #2563eb;
        background: #eff6ff;
        font-weight: 600;
        cursor: default;
    }

    .app-icon {
        font-size: 1rem;
        width: 1.2rem;
        text-align: center;
    }
</style>
