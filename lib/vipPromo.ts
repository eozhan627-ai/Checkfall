// The app's own VIP pop-up on the home screen: remembers when it was shown.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { VIP_PROMO_EVERY_DAYS } from "./config";
import { dayKey } from "./dailyLimitRules";
import { normalizePromoState, shouldShowPromo } from "./vipPromoRules";

const KEY = "vip_promo_v1";

/**
 * Call when the home screen opens. Returns true when the pop-up should be
 * shown now - and remembers that it was shown today.
 */
export async function claimVipPromo(hasVip: boolean): Promise<boolean> {
    try {
        const raw = await AsyncStorage.getItem(KEY);
        const state = normalizePromoState(raw ? JSON.parse(raw) : null);
        const today = dayKey();

        const show = shouldShowPromo(state, today, VIP_PROMO_EVERY_DAYS, hasVip);

        if (show || !state.firstSeen) {
            await AsyncStorage.setItem(
                KEY,
                JSON.stringify({
                    firstSeen: state.firstSeen ?? today,
                    lastShown: show ? today : state.lastShown,
                })
            );
        }

        return show;
    } catch {
        return false;
    }
}
