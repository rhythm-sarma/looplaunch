import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { CHECK_EVERY_MS, msToNextCheck, schedulerEnabled } from "../scheduler";

describe("Daily agenda scheduler", () => {
  test("runs in production unless switched off", () => {
    assert.equal(schedulerEnabled({ NODE_ENV: "production" }), true);
    assert.equal(schedulerEnabled({ NODE_ENV: "production", AGENDA_SCHEDULER: "off" }), false);
    assert.equal(schedulerEnabled({ NODE_ENV: "production", AGENDA_SCHEDULER: " OFF " }), false);
  });

  test("stays off in development unless switched on", () => {
    assert.equal(schedulerEnabled({ NODE_ENV: "development" }), false);
    assert.equal(schedulerEnabled({}), false);
    assert.equal(schedulerEnabled({ NODE_ENV: "development", AGENDA_SCHEDULER: "on" }), true);
  });

  test("checks on the 10-minute marks of the clock", () => {
    const sevenOClock = Date.UTC(2026, 10, 24, 1, 30); // 7:00 AM in India
    assert.equal(msToNextCheck(sevenOClock), CHECK_EVERY_MS);
    assert.equal(msToNextCheck(sevenOClock + 1000), CHECK_EVERY_MS - 1000);
    assert.equal(msToNextCheck(sevenOClock + CHECK_EVERY_MS - 1), 1);
  });
});
