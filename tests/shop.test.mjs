// Run with: npm test
import test from "node:test";
import assert from "node:assert/strict";
import {
    BOARD_THEMES,
    DEFAULT_BOARD_THEME,
    EMPTY_SHOP,
    addCoinsTo,
    boardThemeById,
    buyTheme,
    coinBalance,
    coinsSpent,
    normalizeShop,
    ownsTheme,
    selectTheme,
} from "../lib/boardThemes.ts";
import { EMPTY_PROGRESS, mergeProgress, normalizeProgress, progressEquals } from "../lib/progressMerge.ts";

test("the designs are complete and one is free", () => {
    const ids = new Set();

    for (const theme of BOARD_THEMES) {
        assert.ok(!ids.has(theme.id), theme.id);
        ids.add(theme.id);
        assert.match(theme.light, /^#[0-9a-f]{6}$/i, theme.id);
        assert.match(theme.dark, /^#[0-9a-f]{6}$/i, theme.id);
        assert.notEqual(theme.light, theme.dark);
        assert.ok(Number.isInteger(theme.price) && theme.price >= 0);
    }

    assert.equal(DEFAULT_BOARD_THEME.price, 0);
    assert.equal(BOARD_THEMES.filter((theme) => theme.price === 0).length, 1);
    assert.equal(boardThemeById("does-not-exist"), DEFAULT_BOARD_THEME);
    assert.equal(boardThemeById(null), DEFAULT_BOARD_THEME);
});

test("light and dark squares can be told apart in every design", () => {
    const luminance = (hex) => {
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    for (const theme of BOARD_THEMES) {
        assert.ok(luminance(theme.light) - luminance(theme.dark) > 0.18, theme.id);
        // Dark squares stay light enough for the black pieces to be seen.
        assert.ok(luminance(theme.dark) > 0.16, `${theme.id} dark square too dark`);
    }
});

test("buying needs enough coins and takes them", () => {
    let state = addCoinsTo(EMPTY_SHOP, 250);
    assert.equal(coinBalance(state), 250);

    let result = buyTheme(state, "gold");
    assert.deepEqual(result, { ok: false, reason: "coins", missing: 550 });

    result = buyTheme(state, "forest");
    assert.equal(result.ok, true);
    state = result.state;
    assert.deepEqual([coinBalance(state), coinsSpent(state), state.boardTheme, state.owned], [50, 200, "forest", ["forest"]]);

    assert.deepEqual(buyTheme(state, "forest"), { ok: false, reason: "owned" });
    assert.deepEqual(buyTheme(state, "classic"), { ok: false, reason: "owned" });
    assert.deepEqual(buyTheme(state, "nonsense"), { ok: false, reason: "unknown" });
    assert.deepEqual(buyTheme(state, "ocean"), { ok: false, reason: "coins", missing: 150 });
});

test("only owned designs can be put on the board", () => {
    const state = buyTheme(addCoinsTo(EMPTY_SHOP, 200), "ocean").state;

    assert.equal(selectTheme(state, "classic").boardTheme, "classic");
    assert.equal(selectTheme(state, "gold").boardTheme, "ocean");
    assert.equal(selectTheme(state, "nonsense").boardTheme, "ocean");
    assert.equal(ownsTheme(state, "classic"), true);
    assert.equal(ownsTheme(state, "gold"), false);
});

test("stored data is cleaned up", () => {
    assert.deepEqual(normalizeShop(null), EMPTY_SHOP);
    assert.deepEqual(normalizeShop("x"), EMPTY_SHOP);
    assert.deepEqual(
        normalizeShop({ coinsEarned: 320.9, owned: ["ocean", "ocean", "hacked", 7, "classic"], boardTheme: "gold" }),
        { coinsEarned: 320, owned: ["ocean"], boardTheme: "classic" }
    );
    assert.deepEqual(normalizeShop({ coinsEarned: -5, owned: "no", boardTheme: 3 }), EMPTY_SHOP);
    assert.equal(addCoinsTo(EMPTY_SHOP, -10).coinsEarned, 0);
    assert.equal(addCoinsTo(EMPTY_SHOP, NaN).coinsEarned, 0);
});

test("two devices: nothing bought is lost, no coins appear", () => {
    const phone = normalizeProgress({ shop: { coinsEarned: 500, owned: ["forest"], boardTheme: "forest" } });
    const tablet = normalizeProgress({ shop: { coinsEarned: 300, owned: ["ocean"], boardTheme: "ocean" } });

    const merged = mergeProgress(phone, tablet);

    assert.deepEqual(merged.shop, { coinsEarned: 500, owned: ["forest", "ocean"], boardTheme: "forest" });
    // 500 earned, 400 spent on both devices together.
    assert.equal(coinBalance(normalizeShop(merged.shop)), 100);

    // A new device takes over the account's design.
    assert.equal(mergeProgress(EMPTY_PROGRESS, phone).shop.boardTheme, "forest");

    assert.ok(progressEquals(mergeProgress(tablet, tablet), tablet));
    assert.ok(!progressEquals(phone, tablet));
    assert.ok(progressEquals(normalizeProgress({}), EMPTY_PROGRESS));
});
