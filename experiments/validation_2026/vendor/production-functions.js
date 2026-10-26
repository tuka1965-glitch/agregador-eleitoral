function groupBy(items, keyFn) {
  return items.reduce((map, item) => {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
    return map;
  }, new Map());
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function houseEffectFor(name) {
  return state.houseEffects.get(normalizePollsterKey(canonicalPollsterName(name))) || null;
}

function houseEffectWeight(name) {
  const houseEffect = houseEffectFor(name);
  if (!houseEffect || houseEffect.n <= 2) return 1;
  return Math.min(1.1, Math.max(0.35, 1 / (1 + Math.abs(houseEffect.effect) / 4)));
}

function houseAdjustedValue(value, pollster, candidate = "") {
  if (isSpecialChoice(candidate)) return value;
  const houseEffect = houseEffectFor(pollster);
  if (!houseEffect || houseEffect.n <= 2 || value < 15) return value;
  return clampPercent(value - HOUSE_EFFECT_CORRECTION * houseEffect.effect);
}

function clampPercent(value) {
  return Math.min(100, Math.max(0, value));
}

function systemicCandidateBias(candidate) {
  return 0;
}

function isSpecialChoice(candidate) {
  const text = normalizeName(candidate).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /(indecis|nao sabe|nao respondeu|branco|nulo|nenhum|absten|ausente|absent)/i.test(text);
}

function bayesianEstimateOptions(points, allCandidatePoints, targetTime, halfLifeDays, candidate = "") {
  return {
    points,
    allCandidatePoints,
    targetTime,
    halfLifeDays,
    candidate,
    qualityWeight: pollsterQualityWeight,
    houseWeight: (pollster) => isSpecialChoice(candidate) ? 1 : houseEffectWeight(pollster),
    adjustValue: (point) => houseAdjustedValue(point.pct, point.pollster, candidate),
    bias: systemicCandidateBias,
  };
}

function bayesianEstimateDetailsAt(points, allCandidatePoints, targetTime, halfLifeDays, candidate = "") {
  return globalThis.ElectionModelCore.weightedEstimateDetails(
    bayesianEstimateOptions(points, allCandidatePoints, targetTime, halfLifeDays, candidate),
  );
}

function bayesianEstimateAt(points, allCandidatePoints, targetTime, halfLifeDays, candidate = "") {
  return globalThis.ElectionModelCore.weightedEstimate(
    bayesianEstimateOptions(points, allCandidatePoints, targetTime, halfLifeDays, candidate),
  );
}

function pollUnitsFromRows(rows, scenario) {
  const units = new Map();
  rows
    .filter((poll) => poll.scenario === scenario)
    .forEach((poll) => {
      const key = [poll.scenario, poll.scenarioVariant || "", poll.pollId, poll.scenarioIndex || 1].join("|");
      if (!units.has(key)) {
        units.set(key, {
          key,
          scenario: poll.scenario,
          pollster: poll.pollster,
          dateMid: poll.dateMid,
          t: poll.t,
          sample: poll.sample,
          margin: poll.margin,
          candidates: {},
        });
      }
      units.get(key).candidates[poll.candidate] = poll.pct;
    });
  return [...units.values()].sort((a, b) => a.t - b.t);
}

function regimeStrengthFromRows(rows, scenario, candidates) {
  const units = pollUnitsFromRows(rows, scenario);
  const recent = units.slice(-MOMENTUM_POLL_COUNT);
  const prior = units.slice(-MOMENTUM_POLL_COUNT * 2, -MOMENTUM_POLL_COUNT);
  if (recent.length < MOMENTUM_POLL_COUNT || prior.length < MOMENTUM_POLL_COUNT) return 0;
  return Math.max(
    ...candidates.map((candidate) => {
      const recentValues = recent.map((unit) => unit.candidates[candidate]).filter((value) => value != null);
      const priorValues = prior.map((unit) => unit.candidates[candidate]).filter((value) => value != null);
      if (!recentValues.length || !priorValues.length) return 0;
      return Math.abs(mean(recentValues) - mean(priorValues));
    }),
  );
}

function effectiveHalfLife(rows, scenario, candidates, configuredHalfLife) {
  return regimeStrengthFromRows(rows, scenario, candidates) >= REGIME_SHIFT_THRESHOLD
    ? Math.min(configuredHalfLife, REGIME_HALF_LIFE_DAYS)
    : configuredHalfLife;
}

function recentPollTimes(rows, scenario) {
  return new Set(
    pollUnitsFromRows(rows, scenario)
      .slice(-MOMENTUM_POLL_COUNT)
      .map((unit) => unit.t),
  );
}

function bayesianMeanFromUnits(units, candidate) {
  const points = units
    .filter((unit) => unit.candidates[candidate] != null)
    .map((unit) => ({
      pollster: unit.pollster,
      sample: unit.sample,
      margin: unit.margin,
      t: unit.t,
      pct: unit.candidates[candidate],
    }));
  if (!points.length) return null;
  return globalThis.ElectionModelCore.weightedEstimate({
    points,
    allCandidatePoints: points,
    targetTime: Math.max(...points.map((point) => point.t)),
    candidate,
    qualityWeight: pollsterQualityWeight,
    priorEquivalentPolls: 0,
  });
}

function referenceLeaderFromLast10(previousUnits) {
  const windowUnits = previousUnits.slice(-10);
  const candidates = [...new Set(windowUnits.flatMap((unit) => Object.keys(unit.candidates)))];
  return candidates
    .map((candidate) => ({ candidate, estimate: bayesianMeanFromUnits(windowUnits, candidate) }))
    .filter((row) => row.estimate != null)
    .sort((a, b) => b.estimate - a.estimate)[0];
}

function computeHouseEffects(rows) {
  const effects = [];
  const scenarios = [...new Set(rows.map((poll) => poll.scenario))];
  scenarios.forEach((scenario) => {
    const units = pollUnitsFromRows(rows, scenario);
    units.forEach((unit, index) => {
      const reference = referenceLeaderFromLast10(units.slice(0, index));
      if (!reference) return;
      const instituteValue = unit.candidates[reference.candidate];
      if (instituteValue == null) return;
      effects.push({
        pollster: unit.pollster,
        scenario,
        effect: instituteValue - reference.estimate,
        abs: Math.abs(instituteValue - reference.estimate),
      });
    });
  });

  const grouped = groupBy(effects, (effect) => normalizePollsterKey(canonicalPollsterName(effect.pollster)));
  return new Map(
    [...grouped.entries()].map(([key, items]) => {
      const effect = mean(items.map((item) => item.effect));
      return [key, {
        n: items.length,
        effect,
        abs: mean(items.map((item) => item.abs)),
        // Incerteza da correção parcial, estimada da dispersão histórica
        // dos desvios do próprio instituto.
        standardError: items.length > 2
          ? Math.sqrt(items.reduce((sum, item) => sum + (item.effect - effect) ** 2, 0) / (items.length - 1) / items.length)
          : 0,
      }];
    }),
  );
}
