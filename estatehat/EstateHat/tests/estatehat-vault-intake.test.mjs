import test from "node:test";
import assert from "node:assert/strict";
import { exportVaultIntakeCsv, prepareVaultIntake, removeVaultIntake, VAULT_INTAKE_MAX_RECORDS } from "../src/estatehat-vault-intake.js";

const file = (name, type = "application/pdf", size = 2048, lastModified = 1) => ({ name, type, size, lastModified });

test("vault intake validates supported media, empty files and the 15 MB boundary", () => {
  const result = prepareVaultIntake([file("good.pdf"), file("script.js", "text/javascript"), file("empty.png", "image/png", 0), file("large.pdf", "application/pdf", 16 * 1024 * 1024)], {}, [], new Date("2026-10-16T12:00:00Z"));
  assert.equal(result.added.length, 1);
  assert.equal(result.rejected.length, 3);
  assert.equal("file" in result.added[0], false);
});

test("vault intake rejects duplicates and caps local metadata records", () => {
  const first = prepareVaultIntake([file("same.pdf")], {}, []);
  const duplicate = prepareVaultIntake([file("same.pdf")], {}, first.added);
  assert.match(duplicate.rejected[0].reason, /already/i);
  const full = Array.from({ length: VAULT_INTAKE_MAX_RECORDS }, (_, index) => ({ id: String(index), name: `file-${index}.pdf`, byteSize: 100, lastModified: index }));
  assert.match(prepareVaultIntake([file("new.pdf")], {}, full).rejected[0].reason, /holds up to/i);
});

test("vault intake keeps only local context metadata and removes records by stable ID", () => {
  const result = prepareVaultIntake([file("contract.pdf")], { category: "transaction", docType: "Purchase contract", priority: "high", property: "Example", transaction: "deal-1" }, []);
  assert.equal(result.added[0].docType, "Purchase contract");
  assert.equal(result.added[0].property, "Example");
  assert.equal(removeVaultIntake(result.added, result.added[0].id).length, 0);
});

test("vault intake CSV quotes metadata and protects spreadsheet formulas", () => {
  const csv = exportVaultIntakeCsv([{ name: "=cmd", type: "application/pdf", byteSize: 200, category: "listing", docType: "Purchase, contract" }]);
  assert.match(csv, /'=cmd/);
  assert.match(csv, /"Purchase, contract"/);
});
