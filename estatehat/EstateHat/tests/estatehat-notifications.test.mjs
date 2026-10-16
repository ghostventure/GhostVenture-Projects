import test from "node:test";
import assert from "node:assert/strict";
import { applyNotificationPreferences, countUnreadNotifications, markNotificationsRead, normalizeNotificationPreferences, removeReadNotifications, toggleNotificationPreference } from "../src/estatehat-notifications.js";

const notifications = [{ id: "a", type: "offer" }, { id: "b", type: "task" }, { id: "c", type: "document" }];

test("preferences default on and can independently toggle supported categories", () => {
  const defaults = normalizeNotificationPreferences({ offer: false });
  assert.deepEqual(defaults, { offer: false, task: true, document: true });
  assert.equal(toggleNotificationPreference(defaults, "task").task, false);
  assert.throws(() => toggleNotificationPreference(defaults, "unknown"), /supported/i);
});

test("notification categories filter the inbox without changing source records", () => {
  const prefs = toggleNotificationPreference(normalizeNotificationPreferences(), "task");
  assert.deepEqual(applyNotificationPreferences(notifications, prefs).map((row) => row.id), ["a", "c"]);
  assert.equal(notifications.length, 3);
});

test("unread counts and mark-all-read retain existing read identities", () => {
  assert.equal(countUnreadNotifications(notifications, ["a"]), 2);
  assert.deepEqual(markNotificationsRead(notifications, ["a", "old"]), ["a", "old", "b", "c"]);
});

test("clearing read notifications leaves unread items in the inbox", () => {
  assert.deepEqual(removeReadNotifications(notifications, ["a", "c"]).map((row) => row.id), ["b"]);
});
