import test from "node:test";
import assert from "node:assert/strict";
import { deleteProfileLocalData, exportProfileLocalData, getProfileStorageKeys, summarizeProfileLocalData } from "../src/estatehat-local-data.js";

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: (key) => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key), values };
}

test("profile data keys are account scoped and separate from other accounts", () => {
  const a = getProfileStorageKeys("user-a"); const b = getProfileStorageKeys("user-b");
  assert.notEqual(a.tasks[0], b.tasks[0]);
  assert.ok(a.notifications.every((key) => key.includes("user-a")));
});

test("local-data summary reports only present whitelisted profile categories", () => {
  const keys = getProfileStorageKeys("user-a");
  const db = storage({ [keys.tasks[0]]: "[{\"title\":\"Call lender\"}]", unrelated: "secret" });
  const summary = summarizeProfileLocalData(db, "user-a");
  assert.equal(summary.find((item) => item.category === "tasks").keys, 1);
  assert.equal(summary.filter((item) => item.keys > 0).length, 1);
});

test("export includes only allowlisted local data for the selected account", () => {
  const keys = getProfileStorageKeys("user-a");
  const db = storage({ [keys.tasks[0]]: "[]", [getProfileStorageKeys("user-b").tasks[0]]: "other", firebaseToken: "secret" });
  const bundle = JSON.parse(exportProfileLocalData(db, "user-a", "2026-10-16"));
  assert.equal(bundle.schemaVersion, 1);
  assert.equal(bundle.data.tasks[keys.tasks[0]], "[]");
  assert.deepEqual(bundle.data.finances, {});
  assert.equal(JSON.stringify(bundle).includes("firebaseToken"), false);
  assert.equal(JSON.stringify(bundle).includes("other"), false);
});

test("selective clear deletes only chosen profile data and rejects invalid category sets", () => {
  const keys = getProfileStorageKeys("user-a");
  const otherKey = getProfileStorageKeys("user-b").tasks[0];
  const db = storage({ [keys.tasks[0]]: "[]", [keys.notifications[0]]: "[]", [otherKey]: "[]" });
  assert.equal(deleteProfileLocalData(db, "user-a", ["tasks"]), 1);
  assert.equal(db.getItem(keys.tasks[0]), null);
  assert.equal(db.getItem(keys.notifications[0]), "[]");
  assert.equal(db.getItem(otherKey), "[]");
  assert.throws(() => deleteProfileLocalData(db, "user-a", []), /choose/i);
});
