// Language of the app: English (the texts in the code) or German.
//
// Texts are written in English where they are used and wrapped in tr():
//
//     <Text>{tr("Find an Opponent")}</Text>
//     tr("{0} friends are online", count)
//
// For German, tr() looks the English text up in lib/translations/de.ts. A
// text without a translation is shown in English - nothing breaks.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { DE } from "./translations/de";

export type Language = "en" | "de";

export const LANGUAGES: { code: Language; name: string }[] = [
    { code: "en", name: "English" },
    { code: "de", name: "Deutsch" },
];

const KEY = "app_language_v1";

const DICTIONARIES: Record<Language, Record<string, string> | null> = {
    en: null,
    de: DE,
};

let current: Language = "en";
const listeners = new Set<(language: Language) => void>();

/** Language of the device, used until the player chooses one. */
function deviceLanguage(): Language {
    try {
        const locale = Intl.DateTimeFormat().resolvedOptions().locale || "";
        return locale.toLowerCase().startsWith("de") ? "de" : "en";
    } catch {
        return "en";
    }
}

export function getLanguage(): Language {
    return current;
}

/** Reads the stored choice. Call once when the app starts. */
export async function loadLanguage(): Promise<Language> {
    let next: Language = deviceLanguage();

    try {
        const stored = await AsyncStorage.getItem(KEY);
        if (stored === "en" || stored === "de") next = stored;
    } catch {
        // Keep the device language.
    }

    apply(next);
    return next;
}

export async function setLanguage(language: Language) {
    apply(language);

    try {
        await AsyncStorage.setItem(KEY, language);
    } catch {
        // The choice still applies until the app is closed.
    }
}

function apply(language: Language) {
    if (language === current) return;

    current = language;
    listeners.forEach((listener) => listener(language));
}

/** Current language; the component renders again when it changes. */
export function useLanguage(): Language {
    const [language, setLanguageState] = useState<Language>(current);

    useEffect(() => {
        setLanguageState(current);
        listeners.add(setLanguageState);

        return () => {
            listeners.delete(setLanguageState);
        };
    }, []);

    return language;
}

/**
 * Translates an English text into the current language. "{0}", "{1}", ...
 * are replaced by the extra arguments.
 */
export function tr(text: string, ...values: (string | number | null | undefined)[]): string {
    const dictionary = DICTIONARIES[current];
    const template = (dictionary && dictionary[text]) || text;

    if (values.length === 0) return template;

    return template.replace(/\{(\d+)\}/g, (match, index) => {
        const value = values[Number(index)];
        return value === null || value === undefined ? "" : String(value);
    });
}
