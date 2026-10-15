import test from "node:test";
import assert from "node:assert/strict";
import { uiTag, resourceChip, statRow, rarityOf, rarityBadge, characterName, attributeMarkup, specialtyText } from "../dist/src/ui-components.js";
import { rarityBadge as recruitmentRarityBadge, rarityOf as recruitmentRarityOf } from "../dist/src/recruitment-ui.js";

test("resourceChip keeps trusted icon markup and escapes all text and class attributes", () => {
  const markup = resourceChip({
    glyph: "gem",
    value: "<5 & '6'",
    label: "<보유>",
    prefix: "+\"",
    className: 'resource-inline" data-injected="yes',
    icon: (glyph) => `<svg data-glyph="${glyph}"></svg>`,
  });

  assert.equal(
    markup,
    '<span class="resource-inline&quot; data-injected=&quot;yes"><svg data-glyph="gem"></svg>&lt;보유&gt;+&quot;&lt;5 &amp; &#39;6&#39;</span>',
  );
});

test("resourceChip can emphasize the escaped prefix and value after its label", () => {
  const markup = resourceChip({
    label: "도토리 ",
    prefix: "+<",
    value: "5 & 6",
    strong: true,
    icon: () => "[icon]",
  });

  assert.equal(markup, "<span>[icon]도토리 <strong>+&lt;5 &amp; 6</strong></span>");
});

test("statRow escapes labels and values while retaining the shared stat-row structure", () => {
  assert.equal(
    statRow('<체력>', '5 & "x"'),
    '<div class="stat-item">&lt;체력&gt;<strong>5 &amp; &quot;x&quot;</strong></div>',
  );
});

test("rarity helpers preserve recruitment exports and unknown-rarity fallback", () => {
  const knownUnit = { rarity: "epic" };
  assert.equal(rarityOf(knownUnit), recruitmentRarityOf(knownUnit));
  assert.equal(rarityBadge(knownUnit), recruitmentRarityBadge(knownUnit));
  assert.match(rarityBadge(knownUnit), /영웅<\/strong><\/span>$/);
  assert.match(rarityBadge({ rarity: "unknown" }), /일반<\/strong><\/span>$/);
});

test("characterName uses canonical names and the five approved short labels", () => {
  assert.equal(characterName("squirrel"), "씨앗 다람쥐");
  assert.deepEqual(
    ["sheep", "rabbit", "squirrel", "teapot", "cloud"].map((id) => characterName(id, { short: true })),
    ["양 방패", "속공 토끼", "다람쥐", "주전자", "구름"],
  );
  assert.equal(characterName("beetle", { short: true }), "들판 너구리");
  assert.equal(characterName("missing-character"), "missing-character");
});

test("attribute markup and specialty text share attribute names and preserve plain and rich forms", () => {
  assert.match(attributeMarkup("wild", "<특화>"), /class="ui-tag attribute-label"/);
  assert.match(attributeMarkup("wild", "<특화>"), />야생&lt;특화&gt;<\/strong><\/span>$/);
  assert.match(attributeMarkup("unknown"), /무속성<\/strong><\/span>$/);
  assert.equal(specialtyText({ specialties: [] }), "");
  assert.equal(specialtyText({ specialties: ["wild", "spirit"] }), "야생특화 · 정령특화");
  assert.match(specialtyText({ specialties: ["wild"] }, true), /야생특화<\/strong>/);
  assert.equal(specialtyText({ specialties: ["unknown"] }), "무속성특화");
});

test('shared tags escape their label and metadata', () => {
  const markup = uiTag('<strong>test</strong>', {tone: '" onclick="bad', className: 'sample', keyword: '<key>'});
  assert.match(markup, /class="ui-tag sample"/);
  assert.match(markup, /&lt;strong&gt;test&lt;\/strong&gt;/);
  assert.doesNotMatch(markup, / onclick="bad|<key>/);
  assert.match(rarityBadge({rarity:'epic'}), /data-tone="epic"/);
});
