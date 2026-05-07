<script lang="ts">
    import { currentPage, session, type Page } from "../lib/session.js";
    import AppSwitcher from "./AppSwitcher.svelte";

    interface LeafItem  { kind: "leaf";  id: Page;   label: string; icon: string; }
    interface GroupItem { kind: "group"; id: string; label: string; icon: string; activePages: Page[]; children: LeafItem[]; }
    type NavItem = LeafItem | GroupItem;

    const items: NavItem[] = [
        { kind: "leaf", id: "dashboard", label: "Dashboard", icon: "⊞" },
        {
            kind: "group", id: "people", label: "People", icon: "◉",
            activePages: ["directory", "associations", "association", "add-person"],
            children: [
                { kind: "leaf", id: "directory",    label: "Directory",    icon: "⊞" },
                { kind: "leaf", id: "associations", label: "Associations", icon: "⊟" },
            ],
        },
        {
            kind: "group", id: "governance", label: "Governance", icon: "⚖",
            activePages: ["leadership", "assembly", "pool", "budget", "proposals", "propose", "domains", "domain", "unit", "constitution", "documents", "bylaw", "section"],
            children: [
                { kind: "leaf", id: "propose",      label: "Propose",      icon: "⊕" },
                { kind: "leaf", id: "leadership",   label: "Leadership",   icon: "★" },
                { kind: "leaf", id: "budget",        label: "Budget",       icon: "⊡" },
                { kind: "leaf", id: "domains",       label: "Institutions", icon: "⊛" },
                { kind: "leaf", id: "documents",     label: "Documents",    icon: "§" },
            ],
        },
        {
            kind: "group", id: "jobs", label: "Jobs", icon: "◈",
            activePages: ["vacancies", "schedule"],
            children: [
                { kind: "leaf", id: "vacancies",   label: "Open Roles",    icon: "◈" },
                { kind: "leaf", id: "schedule",    label: "Work Schedule", icon: "⊞" },
            ],
        },
        {
            kind: "group", id: "economics", label: "Economics", icon: "⊜",
            activePages: ["central-bank", "social-insurance"],
            children: [
                { kind: "leaf", id: "central-bank",     label: "Central Bank",     icon: "⊕" },
                { kind: "leaf", id: "social-insurance", label: "Social Insurance", icon: "⊹" },
            ],
        },
        {
            kind: "group", id: "other", label: "Other", icon: "⊙",
            activePages: ["locations", "nodes", "connections", "settings", "timeline", "registry", "calendar", "desired-state"],
            children: [
                { kind: "leaf", id: "calendar",       label: "Events",         icon: "◷" },
                { kind: "leaf", id: "timeline",       label: "Timeline",       icon: "◷" },
                { kind: "leaf", id: "locations",      label: "Locations",      icon: "⊕" },
                { kind: "leaf", id: "nodes",          label: "Nodes",          icon: "⬡" },
                { kind: "leaf", id: "connections",    label: "Connections",    icon: "⬡" },
                { kind: "leaf", id: "registry",       label: "Type Registry",  icon: "⊟" },
                { kind: "leaf", id: "desired-state",  label: "Desired State",  icon: "⊜" },
                { kind: "leaf", id: "settings",       label: "Settings",       icon: "⚙" },
            ],
        },
    ];

    // Desktop accordion: auto-expands to match current page's group; persists across child navigations.
    let desktopExpanded: string | null = $state(null);
    // Mobile sheet: only opens on explicit tap; closes after navigation.
    let mobileSheet: string | null = $state(null);

    // Auto-expand the matching group on desktop whenever the page changes.
    $effect(() => {
        const pg = $currentPage;
        const group = items.find(
            i => i.kind === "group" && (i as GroupItem).activePages.includes(pg as Page)
        ) as GroupItem | undefined;
        if (group) desktopExpanded = group.id;
    });

    function isLeafActive(item: LeafItem): boolean {
        if (item.id === "domains")      return ["domains", "domain", "unit"].includes($currentPage);
        if (item.id === "associations") return ["associations", "association"].includes($currentPage);
        if (item.id === "leadership")   return ["leadership", "assembly", "pool"].includes($currentPage);
        if (item.id === "documents")    return ["documents", "constitution", "bylaw", "section"].includes($currentPage);
        return $currentPage === item.id;
    }

    function isGroupActive(item: GroupItem): boolean {
        return item.activePages.includes($currentPage as Page);
    }

    function toggleGroup(id: string) {
        if (window.matchMedia("(min-width: 768px)").matches) {
            desktopExpanded = desktopExpanded === id ? null : id;
        } else {
            mobileSheet = mobileSheet === id ? null : id;
        }
    }

    function navigate(id: Page) {
        currentPage.go(id);
        mobileSheet = null; // close mobile sheet; desktop accordion stays open via $effect
    }

    const activeSheet = $derived(
        mobileSheet !== null
            ? (items.find(i => i.kind === "group" && i.id === mobileSheet) as GroupItem | undefined)
            : undefined
    );
</script>

<nav class="bottom-nav">
    <div class="nav-brand">
        <span class="brand-icon">⊚</span>
        <span class="brand-name">Community</span>
        <div class="brand-switcher"><AppSwitcher /></div>
    </div>

    {#each items as item}
        {#if item.kind === "leaf"}
            <button
                class="nav-item"
                class:active={isLeafActive(item)}
                onclick={() => navigate(item.id)}
                aria-current={$currentPage === item.id ? "page" : undefined}
            >
                <span class="nav-icon">{item.icon}</span>
                <span class="nav-label">{item.label}</span>
            </button>
        {:else}
            <div class="nav-group">
                <button
                    class="nav-item group-trigger"
                    class:active={isGroupActive(item) || desktopExpanded === item.id || mobileSheet === item.id}
                    onclick={() => toggleGroup(item.id)}
                >
                    <span class="nav-icon">{item.icon}</span>
                    <span class="nav-label">{item.label}</span>
                    <span class="group-chevron" class:open={desktopExpanded === item.id}>▾</span>
                </button>
                <!-- Desktop only: inline accordion children -->
                {#if desktopExpanded === item.id}
                    <div class="nav-children">
                        {#each item.children as child}
                            <button
                                class="nav-item nav-child"
                                class:active={isLeafActive(child)}
                                onclick={() => navigate(child.id)}
                            >
                                <span class="nav-icon">{child.icon}</span>
                                <span class="nav-label">{child.label}</span>
                            </button>
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}
    {/each}

    <div class="sidebar-footer">
        {#if $session}
            <div class="user-info">
                <div class="user-avatar">{$session.firstName[0]}{$session.lastName[0]}</div>
                <div class="user-meta">
                    <span class="user-name">{$session.firstName} {$session.lastName}</span>
                    <span class="user-handle">@{$session.handle}</span>
                </div>
            </div>
            <button class="signout-btn" onclick={() => session.logout()}>Sign out</button>
        {/if}
    </div>
</nav>

<!-- Mobile sub-sheet (outside nav so it overlays the bar) -->
{#if activeSheet}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="sub-backdrop" onclick={() => mobileSheet = null}></div>
    <div class="sub-sheet" role="dialog" aria-label="{activeSheet.label} menu">
        <div class="sub-sheet-label">{activeSheet.label}</div>
        {#each activeSheet.children as child}
            <button
                class="sub-item"
                class:active={isLeafActive(child)}
                onclick={() => navigate(child.id)}
            >
                <span class="sub-icon">{child.icon}</span>
                <span class="sub-name">{child.label}</span>
            </button>
        {/each}
    </div>
{/if}

<style>
    /* ── Mobile (bottom bar) ──────────────────────────────────────────────── */
    .bottom-nav {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        display: flex;
        background: #fff;
        border-top: 1px solid #e2e8f0;
        padding-bottom: env(safe-area-inset-bottom, 0);
        z-index: 100;
        overflow-x: auto;
    }

    .nav-group { display: contents; } /* group is invisible on mobile — trigger renders as flat item */

    .nav-children { display: none; } /* accordion hidden on mobile */

    .nav-item {
        flex: 1;
        min-width: 3rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.2rem;
        padding: 0.6rem 0.25rem;
        background: none;
        border: none;
        cursor: pointer;
        color: #94a3b8;
        transition: color 0.15s;
        white-space: nowrap;
    }

    .nav-item.active { color: #16a34a; }

    .nav-icon  { font-size: 1.25rem; line-height: 1; }
    .nav-label { font-size: 0.6rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.04em; }

    .group-chevron { display: none; } /* hidden on mobile */

    .nav-brand    { display: none; }
    .sidebar-footer { display: none; }

    /* ── Mobile sub-sheet ─────────────────────────────────────────────────── */
    .sub-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.25);
        z-index: 110;
    }

    .sub-sheet {
        position: fixed;
        left: 0;
        right: 0;
        bottom: calc(3.6rem + env(safe-area-inset-bottom, 0px));
        background: #fff;
        border-top: 1px solid #e2e8f0;
        border-radius: 1rem 1rem 0 0;
        padding: 0.6rem 0 0.5rem;
        z-index: 111;
        box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.1);
    }

    .sub-sheet-label {
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #94a3b8;
        padding: 0 1.25rem 0.5rem;
        border-bottom: 1px solid #f1f5f9;
        margin-bottom: 0.25rem;
    }

    .sub-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        width: 100%;
        padding: 0.75rem 1.25rem;
        background: none;
        border: none;
        cursor: pointer;
        font-family: inherit;
        font-size: 0.95rem;
        color: #334155;
        text-align: left;
    }
    .sub-item.active { color: #16a34a; font-weight: 600; }
    .sub-item:hover  { background: #f8fafc; }

    .sub-icon { font-size: 1.1rem; width: 1.5rem; text-align: center; }
    .sub-name { flex: 1; }

    /* ── Desktop (sidebar) ────────────────────────────────────────────────── */
    @media (min-width: 768px) {
        .bottom-nav {
            flex-direction: column;
            width: 220px;
            height: 100dvh;
            top: 0;
            bottom: auto;
            right: auto;
            border-top: none;
            border-right: 1px solid #e2e8f0;
            padding: 1.5rem 0 1rem;
            justify-content: flex-start;
            gap: 0.1rem;
            align-items: stretch;
            overflow: visible;
        }

        /* On desktop the sub-sheet is irrelevant — hide it */
        .sub-backdrop,
        .sub-sheet { display: none; }

        .nav-group { display: block; } /* restore normal block flow */

        .nav-item {
            flex-direction: row;
            justify-content: flex-start;
            padding: 0.65rem 1rem;
            gap: 0.75rem;
            margin: 0 0.5rem;
            border-radius: 10px;
            flex: none;
            min-width: unset;
            width: auto;
            white-space: normal;
        }

        .nav-item.active { background: #f0fdf4; }

        .nav-icon  { font-size: 1.1rem; }
        .nav-label { font-size: 0.875rem; text-transform: none; letter-spacing: 0; font-weight: 500; }

        .group-chevron {
            display: block;
            margin-left: auto;
            font-size: 0.75rem;
            color: #94a3b8;
            transition: transform 0.2s;
            line-height: 1;
        }
        .group-chevron.open { transform: rotate(180deg); }

        /* Accordion children on desktop */
        .nav-children {
            display: flex;
            flex-direction: column;
            gap: 0;
            margin: 0 0.5rem 0.25rem;
            border-left: 2px solid #e2e8f0;
            margin-left: 1.5rem;
        }

        .nav-child {
            padding: 0.5rem 0.75rem;
            margin: 0;
            border-radius: 8px;
            font-size: 0.84rem;
            color: #475569;
        }
        .nav-child .nav-icon  { font-size: 0.95rem; }
        .nav-child .nav-label { font-size: 0.84rem; }
        .nav-child.active { background: #f0fdf4; color: #16a34a; }

        .nav-brand {
            display: flex;
            align-items: center;
            gap: 0.6rem;
            padding: 0.25rem 1.25rem 1.25rem;
            border-bottom: 1px solid #f1f5f9;
            margin-bottom: 0.5rem;
        }

        .brand-switcher { margin-left: auto; }
        .brand-icon { font-size: 1.4rem; color: #16a34a; }
        .brand-name { font-size: 0.95rem; font-weight: 700; color: #0f172a; }

        .sidebar-footer {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            margin-top: auto;
            padding: 0.75rem 0.5rem 0;
            border-top: 1px solid #e2e8f0;
            flex-shrink: 0;
        }
        .user-info {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0 0.25rem;
        }
        .user-avatar {
            width: 2rem;
            height: 2rem;
            border-radius: 50%;
            background: #f0fdf4;
            color: #15803d;
            font-size: 0.7rem;
            font-weight: 700;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }
        .user-meta { display: flex; flex-direction: column; min-width: 0; }
        .user-name {
            font-size: 0.8rem;
            font-weight: 600;
            color: #0f172a;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .user-handle { font-size: 0.72rem; color: #94a3b8; }
        .signout-btn {
            width: 100%;
            padding: 0.35rem 0.75rem;
            background: none;
            border: 1px solid #e2e8f0;
            border-radius: 0.5rem;
            font-size: 0.78rem;
            color: #64748b;
            cursor: pointer;
            font-family: inherit;
            transition: background 0.1s;
        }
        .signout-btn:hover { background: #f1f5f9; color: #0f172a; }
    }
</style>
