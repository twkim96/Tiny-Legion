export const ATTRIBUTES = [
  { id: "wild", name: "야생", symbol: "♧", color: "#72b54b", ink: "#3f852e", colorName: "초록색" },
  { id: "machine", name: "기계", symbol: "⚙", color: "#a8b5c5", ink: "#667487", colorName: "은색" },
  { id: "spirit", name: "정령", symbol: "◇", color: "#69c8ed", ink: "#287f9e", colorName: "하늘색" },
  { id: "shadow", name: "그림자", symbol: "☾", color: "#9a69cf", ink: "#7845ab", colorName: "보라색" },
];
export const NEUTRAL_ATTRIBUTE = { id: "normal", name: "무속성", color: "#f2f1e8", colorName: "흰색" };
export const FAMILIES = Object.freeze({
  forest: Object.freeze({ name: '숲' }), workshop: Object.freeze({ name: '공방' }),
  starlight: Object.freeze({ name: '별빛' }), winter: Object.freeze({ name: '겨울' }),
});
for (const attribute of ATTRIBUTES) Object.freeze(attribute);
Object.freeze(ATTRIBUTES); Object.freeze(NEUTRAL_ATTRIBUTE);
export const familyName = id => FAMILIES[id]?.name ?? '';
export const attributeLabel = id => [...ATTRIBUTES, NEUTRAL_ATTRIBUTE].find(attribute => attribute.id === id)?.name ?? '';
