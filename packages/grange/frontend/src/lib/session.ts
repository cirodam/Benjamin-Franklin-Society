import { writable } from "svelte/store";

export interface SessionData {
    personId:  string;
    firstName: string;
    lastName:  string;
    handle:    string;
    token:     string;
    appPermissions: Record<string, string[]>;
}

const SESSION_KEY = "ecf_grange_session";
const TOKEN_KEY   = "ecf_grange_token";

function loadFromStorage(): SessionData | null {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        return raw ? (JSON.parse(raw) as SessionData) : null;
    } catch {
        return null;
    }
}

export function getToken(): string | null {
    return sessionStorage.getItem(TOKEN_KEY);
}

function createSessionStore() {
    const { subscribe, set } = writable<SessionData | null>(loadFromStorage());

    return {
        subscribe,
        login(data: SessionData) {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
            sessionStorage.setItem(TOKEN_KEY, data.token);
            set(data);
        },
        logout() {
            sessionStorage.removeItem(SESSION_KEY);
            sessionStorage.removeItem(TOKEN_KEY);
            set(null);
        },
    };
}

export const session = createSessionStore();
