// Run with: npm test
import test from "node:test";
import assert from "node:assert/strict";
import {
    ALL_DONE_BONUS_COINS,
    COINS_PER_TASK,
    DAILY_XP,
    TASK_POOL,
    applyTaskEvent,
    bonusXpFor,
    countPlies,
    taskDayKey,
    taskStateForToday,
    tasksForDay,
    viewTasks,
} from "../lib/dailyTaskRules.ts";

test("every day has three tasks, one of each kind, the same on every device", () => {
    const seen = new Set();

    for (let day = 1; day <= 28; day++) {
        const key = `2026-10-${String(day).padStart(2, "0")}`;
        const tasks = tasksForDay(key);

        assert.deepEqual(tasks.map((task) => task.group), ["play", "train", "learn"]);
        assert.deepEqual(tasksForDay(key), tasks);
        tasks.forEach((task) => seen.add(task.id));
    }

    // Over four weeks every task comes up.
    assert.equal(seen.size, TASK_POOL.length);
});

test("every day is worth 250 XP and 100 coins in total", () => {
    for (let day = 1; day <= 28; day++) {
        for (const guest of [false, true]) {
            const tasks = tasksForDay(`2026-12-${String(day).padStart(2, "0")}`, { guest });
            const bonus = bonusXpFor(tasks);

            assert.ok(bonus >= 30, `bonus ${bonus}`);
            assert.equal(tasks.reduce((sum, task) => sum + task.xp, 0) + bonus, DAILY_XP);

            // Finishing everything pays out exactly that.
            let state = taskStateForToday(null, "x");
            let xp = 0;
            let coins = 0;
            for (const task of tasks) {
                const outcome = applyTaskEvent(state, tasks, task.event, task.goal);
                state = outcome.state;
                xp += outcome.xpGain;
                coins += outcome.coinGain;
            }
            assert.equal(xp, DAILY_XP);
            assert.equal(coins, 3 * COINS_PER_TASK + ALL_DONE_BONUS_COINS);
            assert.equal(coins, 100);
        }
    }
});

test("guests never get a task that needs an account", () => {
    for (let day = 1; day <= 28; day++) {
        const tasks = tasksForDay(`2026-11-${String(day).padStart(2, "0")}`, { guest: true });
        assert.equal(tasks.length, 3);
        assert.ok(tasks.every((task) => !task.accountOnly));
    }
});

test("the day key is the local date", () => {
    assert.equal(taskDayKey(new Date(2026, 9, 3, 23, 59)), "2026-10-03");
    assert.equal(taskDayKey(new Date(2026, 0, 5, 0, 1)), "2026-01-05");
});

const TASKS = [
    { id: "play_3", group: "play", event: "game_played", goal: 3, xp: 40 },
    { id: "puzzles_3", group: "train", event: "puzzle_solved", goal: 3, xp: 25 },
    { id: "lesson_1", group: "learn", event: "lesson_done", goal: 1, xp: 25 },
];
const BONUS = DAILY_XP - 40 - 25 - 25;

test("progress counts up and XP are given once", () => {
    let state = taskStateForToday(null, "2026-10-03");

    let outcome = applyTaskEvent(state, TASKS, "puzzle_solved");
    assert.deepEqual([outcome.xpGain, outcome.coinGain, outcome.finished, outcome.bonus], [0, 0, [], false]);
    assert.equal(viewTasks(outcome.state, TASKS)[1].progress, 1);

    outcome = applyTaskEvent(outcome.state, TASKS, "puzzle_solved", 2);
    assert.deepEqual([outcome.xpGain, outcome.coinGain, outcome.finished], [25, COINS_PER_TASK, ["puzzles_3"]]);

    // More puzzles: no more XP, progress stays at the goal.
    outcome = applyTaskEvent(outcome.state, TASKS, "puzzle_solved", 5);
    assert.equal(outcome.xpGain, 0);
    assert.deepEqual(viewTasks(outcome.state, TASKS)[1], { ...TASKS[1], progress: 3, done: true });

    state = outcome.state;
    outcome = applyTaskEvent(state, TASKS, "lesson_done");
    assert.equal(outcome.xpGain, 25);

    outcome = applyTaskEvent(outcome.state, TASKS, "game_played", 3);
    assert.deepEqual([outcome.xpGain, outcome.coinGain, outcome.bonus], [40 + BONUS, COINS_PER_TASK + ALL_DONE_BONUS_COINS, true]);

    outcome = applyTaskEvent(outcome.state, TASKS, "game_played");
    assert.deepEqual([outcome.xpGain, outcome.bonus], [0, false]);
});

test("an event without a task today changes nothing visible", () => {
    const outcome = applyTaskEvent(taskStateForToday(null, "2026-10-03"), TASKS, "game_won");
    assert.equal(outcome.xpGain, 0);
    assert.ok(viewTasks(outcome.state, TASKS).every((task) => task.progress === 0));
});

test("a new day starts from zero, broken data too", () => {
    const yesterday = { date: "2026-10-02", events: { puzzle_solved: 3 }, rewarded: ["puzzles_3"], bonusRewarded: true };

    assert.deepEqual(taskStateForToday(yesterday, "2026-10-03"), {
        date: "2026-10-03", events: {}, rewarded: [], bonusRewarded: false,
    });
    assert.deepEqual(taskStateForToday(yesterday, "2026-10-02"), yesterday);
    assert.deepEqual(taskStateForToday("nonsense", "2026-10-03").events, {});
    assert.deepEqual(
        taskStateForToday({ date: "2026-10-03", events: { puzzle_solved: -4, lesson_done: "x", game_won: 2.9 }, rewarded: "no" }, "2026-10-03"),
        { date: "2026-10-03", events: { game_won: 2 }, rewarded: [], bonusRewarded: false }
    );
});

test("half-moves are counted from the game record", () => {
    assert.equal(countPlies(""), 0);
    assert.equal(countPlies(null), 0);
    assert.equal(countPlies("1. e4 e5 2. Nf3 Nc6 3. Bb5"), 5);
    assert.equal(countPlies('[Event "x"]\n[White "a"]\n\n1. e4 {best} e5 2. Qh5 Ke7 3. Qxe5# 1-0'), 5);
    assert.equal(countPlies("1.e4 e5 2.Nf3 *"), 3);
});
