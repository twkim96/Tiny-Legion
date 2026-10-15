import test from "node:test";
import assert from "node:assert/strict";
import {
  claimMail,
  claimMission,
  completeChallenge,
  currentMission,
  mailboxEntries,
  newAccount,
  normalizeAccount,
  ownsUnit,
} from "../dist/src/account.js";

const now = Date.UTC(2026, 9, 11, 3);
const foxMailId = "mission:challenge-3:fox";
const chickMailId = "mission:challenge-4:chick";

function readyForStage3() {
  const account = newAccount(now);
  account.onboarding.phase = "complete";
  account.earlyGuide = { phase: "complete", legacy: true };
  account.highestCleared = 2;
  account.missions = { idleCompleted: true, claimed: ["idle-intro", "challenge-2"] };
  return account;
}

test("stage 3 and 4 mission claims enqueue fox and chick; claiming mail alone grants ownership", () => {
  let account = readyForStage3();
  completeChallenge(account, 3);
  assert.equal(ownsUnit(account, "fox"), false);
  const stage3Mission = currentMission(account);
  assert.equal(stage3Mission.id, "challenge-3");
  assert.equal(stage3Mission.unitReward, "fox");
  assert.deepEqual(claimMission(account), {
    id: stage3Mission.id, gold: stage3Mission.gold, diamonds: stage3Mission.diamonds,
  });
  assert.deepEqual(mailboxEntries(account), [
    { id: foxMailId, unitId: "fox", claimed: false },
  ]);
  assert.equal(ownsUnit(account, "fox"), false);
  assert.equal(claimMission(account), null);

  account = normalizeAccount(JSON.parse(JSON.stringify(account)), now);
  assert.deepEqual(mailboxEntries(account), [
    { id: foxMailId, unitId: "fox", claimed: false },
  ]);
  const fox = claimMail(account, foxMailId);
  assert.equal(fox.unit.id, "fox");
  assert.equal(fox.isNew, true);
  assert.equal(fox.guaranteed, true);
  assert.equal(ownsUnit(account, "fox"), true);
  assert.deepEqual(mailboxEntries(account), [
    { id: foxMailId, unitId: "fox", claimed: true },
  ]);
  const claimedSnapshot = JSON.stringify(account);
  assert.equal(claimMail(account, foxMailId), null);
  assert.equal(JSON.stringify(account), claimedSnapshot);

  completeChallenge(account, 4);
  const stage4Mission = currentMission(account);
  assert.equal(stage4Mission.id, "challenge-4");
  assert.equal(stage4Mission.unitReward, "chick");
  assert.deepEqual(claimMission(account), {
    id: stage4Mission.id, gold: stage4Mission.gold, diamonds: stage4Mission.diamonds,
  });
  assert.equal(ownsUnit(account, "chick"), false);
  assert.deepEqual(mailboxEntries(account), [
    { id: foxMailId, unitId: "fox", claimed: true },
    { id: chickMailId, unitId: "chick", claimed: false },
  ]);
  assert.equal(claimMail(account, chickMailId).unit.id, "chick");
  assert.equal(ownsUnit(account, "chick"), true);
  assert.equal(currentMission(account).unitReward, undefined);
  const restored = normalizeAccount(JSON.parse(JSON.stringify(account)), now);
  assert.deepEqual(mailboxEntries(restored), [
    { id: foxMailId, unitId: "fox", claimed: true },
    { id: chickMailId, unitId: "chick", claimed: true },
  ]);
});

test("duplicate mail grants the normal rare mark once and invalid mail claims are inert", () => {
  const account = readyForStage3();
  completeChallenge(account, 3);
  account.owned.fox = true;
  account.marks.wild = 4;
  claimMission(account);
  const reward = claimMail(account, foxMailId);
  assert.equal(reward.isNew, false);
  assert.equal(reward.marks, 5);
  assert.equal(account.marks.wild, 9);
  const snapshot = JSON.stringify(account);
  assert.equal(claimMail(account, foxMailId), null);
  assert.equal(claimMail(account, "mission:challenge-3:chick"), null);
  assert.equal(JSON.stringify(account), snapshot);
});

test("normalization keeps only valid queued mail and does not backfill old claimed missions", () => {
  const old = newAccount(now);
  old.onboarding.phase = "complete";
  old.highestCleared = 4;
  old.missions.claimed = ["challenge-3", "challenge-4"];
  const legacy = normalizeAccount(old, now);
  assert.deepEqual(mailboxEntries(legacy), []);
  assert.equal(ownsUnit(legacy, "fox"), false);
  assert.equal(ownsUnit(legacy, "chick"), false);

  old.mailbox = [
    { id: foxMailId, unitId: "chick", claimed: false },
    { id: foxMailId, unitId: "fox", claimed: false },
    { id: foxMailId, unitId: "fox", claimed: false },
    { id: chickMailId, unitId: "chick", claimed: "false" },
    { id: "mission:unknown:whale", unitId: "whale", claimed: false },
  ];
  assert.deepEqual(mailboxEntries(normalizeAccount(old, now)), [
    { id: foxMailId, unitId: "fox", claimed: false },
  ]);
});
