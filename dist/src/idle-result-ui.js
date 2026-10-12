// Compare rates because older records may have a different measuring period.
export function idleRecordMarkup({ gold, duration, previousRecord, icon, fmt }) {
  const hourly = gold * 3600 / duration;
  const previousHourly = previousRecord ? previousRecord.gold * 3600 / (previousRecord.productionSeconds ?? 120) : 0;
  const improved = !previousRecord || hourly > previousHourly;
  const comparison = improved
    ? `최고 기록 갱신 · 시간당 도토리 ${fmt(previousHourly)} → ${fmt(hourly)}`
    : `최고 기록 유지 · 시간당 도토리 ${fmt(previousHourly)}`;
  return `<div class="idle-record"><span>이번에 측정한 생산 기록</span><strong>${icon("acorn")}${fmt(gold)} / ${duration}초</strong></div><p class="settings-note">${comparison}</p>`;
}
