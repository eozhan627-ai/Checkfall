// Reports about players, the support form and automatic error reports.
// The server stores them (see feedback.js on the server).

import { Platform } from "react-native";
import type { Socket } from "socket.io-client";
import { SERVER_URL } from "./config";
import { log } from "./log";
import { supabase } from "./supabase";

export type ReportReason = "cheating" | "abuse" | "stalling" | "name" | "other";
export type SupportCategory = "bug" | "account" | "payment" | "player" | "idea" | "other";

export const REPORT_REASONS: ReportReason[] = ["cheating", "abuse", "stalling", "name", "other"];
export const SUPPORT_CATEGORIES: SupportCategory[] = ["bug", "account", "payment", "player", "idea", "other"];

export type SendResult = { ok: true } | { ok: false; error: string };

function appVersion(): string {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return String(require("../app.json")?.expo?.version ?? "");
    } catch {
        return "";
    }
}

async function authHeader(): Promise<Record<string, string>> {
    try {
        const {
            data: { session },
        } = await supabase.auth.getSession();

        return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
    } catch {
        return {};
    }
}

async function post(path: string, body: Record<string, unknown>): Promise<SendResult> {
    try {
        const response = await fetch(`${SERVER_URL}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(await authHeader()) },
            body: JSON.stringify({ ...body, platform: Platform.OS, appVersion: appVersion() }),
        });

        if (response.ok) return { ok: true };

        let error = `HTTP_${response.status}`;
        try {
            error = (await response.json())?.error || error;
        } catch {
            // keep the status code
        }

        return { ok: false, error };
    } catch {
        return { ok: false, error: "NETWORK" };
    }
}

/** Reports the opponent of a game. The server works out who that was. */
export function reportPlayer(
    socket: Socket | null | undefined,
    roomId: string | null | undefined,
    reason: ReportReason,
    details: string
): Promise<SendResult> {
    return new Promise((resolve) => {
        if (!socket?.connected || !roomId) {
            resolve({ ok: false, error: "NETWORK" });
            return;
        }

        const timeout = setTimeout(() => resolve({ ok: false, error: "NETWORK" }), 8000);

        socket.emit("report_player", { roomId, reason, details }, (answer: { ok?: boolean; error?: string } | undefined) => {
            clearTimeout(timeout);
            resolve(answer?.ok ? { ok: true } : { ok: false, error: answer?.error || "NOT_SAVED" });
        });
    });
}

export function sendSupportRequest(category: SupportCategory, message: string, contact: string): Promise<SendResult> {
    return post("/support", { category, message, contact });
}

// ---------------------------------------------------------------------------
// Automatic error reports
// ---------------------------------------------------------------------------
// When the app runs into an error it did not expect, a short report (error
// text, where in the code, which screen, app version) goes to the server, so
// problems on other people's phones become visible. Not in development
// builds - there the error is on the screen anyway.

const MAX_REPORTS_PER_START = 5;
const sent = new Set<string>();
let currentScreen = "";

/** Called by the app when the visible screen changes. */
export function setErrorScreen(path: string) {
    currentScreen = path;
}

export function reportError(error: unknown, fatal = false) {
    try {
        if (__DEV__) return;

        const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);

        // The same error once, and only a handful per start of the app.
        if (!message || sent.has(message) || sent.size >= MAX_REPORTS_PER_START) return;
        sent.add(message);

        const stack = error instanceof Error && error.stack ? error.stack : "";

        post("/client-error", { message, stack, screen: currentScreen, fatal }).catch(() => undefined);
    } catch {
        // Reporting an error must never cause one.
    }
}

let installed = false;

/** Call once when the app starts. */
export function installErrorReporting() {
    if (installed) return;
    installed = true;

    try {
        if (Platform.OS === "web") {
            if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
                window.addEventListener("error", (event: any) => reportError(event?.error ?? event?.message, false));
                window.addEventListener("unhandledrejection", (event: any) => reportError(event?.reason, false));
            }
            return;
        }

        // React Native: keep the existing handler (it shows the error screen
        // or closes the app) and report before it runs.
        const utils = (globalThis as any).ErrorUtils;

        if (utils?.setGlobalHandler) {
            const previous = utils.getGlobalHandler?.();

            utils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
                reportError(error, Boolean(isFatal));
                previous?.(error, isFatal);
            });
        }
    } catch (error) {
        log("ERROR REPORTING NOT INSTALLED:", error);
    }
}
