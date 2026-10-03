// Central place for values that were previously copied into several files.

export const SERVER_URL = "https://checkfall-server-clean-1.onrender.com";

export const DEFAULT_RATING = 1000;

// =============================
// ADS (AdMob)
// =============================
// Rewarded ads shown to players without VIP when a daily limit is reached.
//
// To switch real ads on (until then the app shows its own VIP screen with a
// countdown instead):
//   1. npx expo install react-native-google-mobile-ads
//   2. In app.json add to "plugins":
//        ["react-native-google-mobile-ads", {
//            "androidAppId": "ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy",
//            "iosAppId": "ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy"
//        }]
//      (the APP ids from your AdMob account - they contain a "~")
//   3. Put your rewarded AD UNIT ids (they contain a "/") below.
//   4. Build the app again (npx expo prebuild --clean, then a new build) -
//      ads contain native code and do not work in Expo Go.
//
// The values below are Google's public TEST ids - they show test ads and
// earn nothing. Replace them with the ad unit ids from your AdMob account
// before publishing. (Never tap your own real ads while developing; use the
// test ids for that.)
// true:  development builds show Google's test ads (always safe).
// false: development builds use your real ad unit too. Only do this when
//        your phone is registered as a test device in AdMob (Settings ->
//        Test devices) - then the real unit shows ads marked "Test Ad".
//        Tapping your own real, unmarked ads can get the account suspended.
export const ADMOB_TEST_ADS_IN_DEV = true;

const USE_TEST_ADS = __DEV__ && ADMOB_TEST_ADS_IN_DEV;

export const ADMOB_REWARDED_UNIT = {
    android: USE_TEST_ADS ? "ca-app-pub-3940256099942544/5224354917" : "ca-app-pub-1563396210958550/9988420596",
    ios: "ca-app-pub-3940256099942544/1712485313",
};

/** Seconds of the built-in VIP screen that is shown when no ad is available. */
export const FALLBACK_AD_SECONDS = 15;

// =============================
// VIP SUBSCRIPTIONS (Google Play, through RevenueCat)
// =============================
// Public SDK key of the Android app in RevenueCat (starts with "goog_").
// While it is empty, the VIP page shows "Coming soon" instead of the
// purchase buttons.
//
// Set up in RevenueCat:
//   - entitlements named exactly  silver, gold, diamond
//   - one offering (marked "current") with three packages whose identifiers
//     are  silver, gold, diamond  - each with the matching monthly product
//     from Google Play
// The 14-day free trial is an offer on the subscription in the Google Play
// Console; the app shows it automatically when the store reports one.
export const REVENUECAT_API_KEY = {
    android: "",
    ios: "",
};

/** Days between two VIP pop-ups on the home screen (players without VIP). */
export const VIP_PROMO_EVERY_DAYS = 1;

/**
 * Length of the free trial as advertised in the app's own VIP pop-up. Must
 * match the trial offer set up in the Google Play Console (0 = do not
 * mention a trial).
 */
export const VIP_TRIAL_DAYS = 14;
