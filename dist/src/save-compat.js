// Temporary compatibility for pre-feature test saves. Keep new migrations out of
// gameplay modules; remove this module and its load-time calls when old saves retire.
import { UNITS, STAGES, STARTER_UNIT_IDS } from "./data.js";
import { DUPLICATE_MARKS, markTypeFor } from "./abilities.js";

export function legacyStarterSave(raw) {
  if (Object.hasOwn(raw, "onboarding")) return raw;
  return {
    ...raw,
    onboarding: { phase: "complete" },
    owned: { ...raw.owned, ...Object.fromEntries(STARTER_UNIT_IDS.map(id => [id, true])) },
    sequence: Array.isArray(raw.sequence) ? raw.sequence : [...STARTER_UNIT_IDS],
  };
}

// Called after current fields are validated, before lineups are initialized.
export function restoreLegacyProgress(a, raw, hasValidGuidePhase) {
  if (!Object.hasOwn(raw, "marks")) {
    // Convert only unused legacy fragments once; already purchased levels stay intact.
    for (const unit of UNITS) {
      a.marks[markTypeFor(unit)] += a.fragments[unit.id] * DUPLICATE_MARKS[unit.rarity];
      a.fragments[unit.id] = 0;
    }
  }
  if (!Object.hasOwn(raw, "missions")) {
    a.missions = { idleCompleted: false, claimed: [] };
    if (a.onboarding.phase === "complete") {
      if (a.highestCleared >= 2) {
        a.missions.idleCompleted = true;
        a.missions.claimed = [
          "idle-intro",
          ...STAGES.slice(1, a.highestCleared).map((stage) => `challenge-${stage.id}`),
        ];
      } else if (a.highestCleared === 1) {
        const introRecord = a.records[1];
        if (
          Number.isFinite(introRecord?.survival) &&
          introRecord.survival >= (introRecord.productionSeconds ?? 120) &&
          Number.isFinite(introRecord?.hpRatio) &&
          introRecord.hpRatio > 0
        ) {
          a.missions.idleCompleted = true;
        }
      }
    }
  }
  if (!hasValidGuidePhase) {
    const progressed = a.highestCleared >= 2 || UNITS.some(u => a.levels[u.id] > 1 || a.special[u.id] > 0);
    if (progressed) a.earlyGuide = { phase: "complete", legacy: true };
  }
  // Earlier tutorial saves removed the castle specialist from the shared lineup.
  if (!Array.isArray(raw.sequencePresets?.challenge) && !a.earlyGuide.legacy &&
      ["remove-rabbit", "idle-retry", "growth", "complete"].includes(a.earlyGuide.phase) && a.owned.rabbit === true) {
    const sequence = a.sequencePresets.challenge;
    const slot = sequence.indexOf(null);
    if (!sequence.includes("rabbit")) sequence[slot < 0 ? 9 : slot] = "rabbit";
  }
}

export function restoreLegacyGems(raw, state, { count, nextUid }) {
  if (Object.hasOwn(raw, "gemItems")) return false;
  for (const type of ["attack", "hp", "gold"]) {
    const owned = count(Number(raw.gems?.[type]));
    if (!owned) continue;
    const allocation = nextUid(state.gemItems, state.nextGemUid);
    state.nextGemUid = allocation.next;
    state.gemItems.push({ uid: allocation.uid, type, level: 1, optionTier: 'normal', options: [] });
    state.gemReserves[type] = owned - 1;
    if (raw.equippedGem === type) state.gemEquipment[type] = allocation.uid;
  }
  return true;
}
