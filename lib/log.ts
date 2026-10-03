// Debug logging that only prints in development builds. Release builds stay
// quiet (and do not leak user ids or tokens into the device log).

declare const __DEV__: boolean;

const isDev = typeof __DEV__ !== "undefined" && __DEV__;

export function log(...args: unknown[]) {
    if (isDev) {
        console.log(...args);
    }
}

// Errors are always reported.
export function logError(...args: unknown[]) {
    console.error(...args);
}
