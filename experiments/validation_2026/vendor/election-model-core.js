(function attachElectionModelCore(root) {
  const DAY_MS = 24 * 60 * 60 * 1000;

  const PRODUCTION_MODEL_CONFIG = Object.freeze({
    halfLifeDays: 21,
    priorEquivalentPolls: 1,
    momentumWeight: 2,
    momentumPollCount: 5,
    studentTDegreesFreedom: 10,
    instituteWeightCap: 0.25,
    instituteWeightCapMinimumPollsters: 4,
    diagnosticLookbackDays: 14,
    diagnosticFallbackDays: 21,
    diagnosticMinimumPolls: 5,
    diagnosticMinimumPollsters: 3,
    outlierZThreshold: 2.5,
    outlierMinimumGap: 3,
    legacyLeverageThreshold: 0.2,
    influenceThreshold: 0.75,
    simulations: 100000,
    seed: 20260601,
  });

  function clampPercent(value) {
    return Math.min(100, Math.max(0, value));
  }

  function median(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function standardError(point) {
    if (Number.isFinite(point.margin) && point.margin > 0) return point.margin / 1.96;
    if (Number.isFinite(point.sample) && point.sample > 0) {
      return 100 * Math.sqrt(0.25 / Math.max(100, point.sample));
    }
    return 3 / 1.96;
  }

  function robustBetweenPollVariance(entries) {
    if (entries.length < 3) return 0;
    const center = median(entries.map((entry) => entry.value));
    const mad = median(entries.map((entry) => Math.abs(entry.value - center)));
    const robustObservedVariance = (1.4826 * mad) ** 2;
    const typicalSamplingVariance = median(entries.map((entry) => entry.seSquared));
    return Math.max(0, robustObservedVariance - typicalSamplingVariance);
  }

  function applyInstituteCap(entries, cap, minimumPollsters) {
    const pollsters = new Set(entries.map((entry) => entry.pollsterKey));
    if (pollsters.size < minimumPollsters || cap <= 0 || cap >= 1) return;

    for (let pass = 0; pass < 12; pass += 1) {
      const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
      if (!total) return;
      const grouped = new Map();
      entries.forEach((entry) => {
        grouped.set(entry.pollsterKey, (grouped.get(entry.pollsterKey) || 0) + entry.weight);
      });
      let changed = false;
      grouped.forEach((groupWeight, pollsterKey) => {
        const otherWeight = total - groupWeight;
        if (groupWeight <= cap * total + 1e-12 || otherWeight <= 0) return;
        const targetWeight = (cap / (1 - cap)) * otherWeight;
        const scale = targetWeight / groupWeight;
        entries.forEach((entry) => {
          if (entry.pollsterKey === pollsterKey) entry.weight *= scale;
        });
        changed = true;
      });
      if (!changed) return;
    }
  }

  function prepareEntries({
    points,
    targetTime,
    halfLifeDays,
    candidate,
    momentumWeight,
    qualityWeight,
    houseWeight,
    adjustValue,
    studentTDegreesFreedom,
    instituteWeightCap,
    instituteWeightCapMinimumPollsters,
  }) {
    const entries = points.map((point, index) => {
      const ageDays = Math.max(0, (targetTime - point.t) / DAY_MS);
      const timeWeight = 0.5 ** (ageDays / halfLifeDays);
      const quality = Math.max(0.01, qualityWeight(point.pollster));
      const house = Math.max(0.01, houseWeight(point.pollster, candidate));
      const momentum = point.isRecent ? momentumWeight : 1;
      const se = standardError(point);
      const seSquared = se * se;
      const value = adjustValue(point, candidate);
      const marginPrecision = Number.isFinite(point.margin) && point.margin > 0
        ? 1 / Math.max(0.0001, point.margin * point.margin)
        : 1 / Math.max(0.0001, (1.96 * se) ** 2);
      return {
        index,
        point,
        value,
        se,
        seSquared,
        pollsterKey: String(point.pollster || "sem instituto").trim().toLocaleLowerCase("pt-BR"),
        timeWeight,
        quality,
        house,
        momentum,
        legacyWeight: Math.max(300, point.sample || 1000) * marginPrecision * timeWeight * quality * house * momentum,
      };
    });

    const tauSquared = robustBetweenPollVariance(entries);
    const center = median(entries.map((entry) => entry.value));
    entries.forEach((entry) => {
      const totalVariance = Math.max(1e-9, entry.seSquared + tauSquared);
      const z = (entry.value - center) / Math.sqrt(totalVariance);
      const robustMultiplier = Math.min(1, (studentTDegreesFreedom + 1) / (studentTDegreesFreedom + z * z));
      entry.preliminaryZ = z;
      entry.robustMultiplier = robustMultiplier;
      entry.weight = entry.timeWeight * entry.quality * entry.house * entry.momentum * robustMultiplier / totalVariance;
    });
    applyInstituteCap(entries, instituteWeightCap, instituteWeightCapMinimumPollsters);
    return { entries, tauSquared, center };
  }

  function estimateInternal(options) {
    const {
      points,
      allCandidatePoints = points,
      targetTime,
      halfLifeDays = PRODUCTION_MODEL_CONFIG.halfLifeDays,
      candidate = "",
      priorEquivalentPolls = PRODUCTION_MODEL_CONFIG.priorEquivalentPolls,
      momentumWeight = PRODUCTION_MODEL_CONFIG.momentumWeight,
      qualityWeight = () => 1,
      houseWeight = () => 1,
      adjustValue = (point) => point.pct,
      bias = () => 0,
      studentTDegreesFreedom = PRODUCTION_MODEL_CONFIG.studentTDegreesFreedom,
      instituteWeightCap = PRODUCTION_MODEL_CONFIG.instituteWeightCap,
      instituteWeightCapMinimumPollsters = PRODUCTION_MODEL_CONFIG.instituteWeightCapMinimumPollsters,
    } = options;
    if (!points.length) return null;

    const prepared = prepareEntries({
      points,
      targetTime,
      halfLifeDays,
      candidate,
      momentumWeight,
      qualityWeight,
      houseWeight,
      adjustValue,
      studentTDegreesFreedom,
      instituteWeightCap,
      instituteWeightCapMinimumPollsters,
    });
    const { entries, tauSquared } = prepared;
    const priorSource = allCandidatePoints.length ? allCandidatePoints : points;
    const priorMean = median(priorSource.map((point) => adjustValue(point, candidate)));
    const typicalWeight = median(entries.map((entry) => entry.weight).filter((weight) => weight > 0)) || 1;
    const priorWeight = typicalWeight * Math.max(0, priorEquivalentPolls);
    const observationWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
    const weightedValue = entries.reduce((sum, entry) => sum + entry.value * entry.weight, 0);
    const rawEstimate = (priorMean * priorWeight + weightedValue) / Math.max(1e-9, priorWeight + observationWeight);
    const estimate = clampPercent(rawEstimate + bias(candidate));
    const legacyTotal = entries.reduce((sum, entry) => sum + entry.legacyWeight, 0);

    entries.forEach((entry) => {
      entry.finalShare = observationWeight ? entry.weight / observationWeight : 0;
      entry.legacyShare = legacyTotal ? entry.legacyWeight / legacyTotal : 0;
    });

    return {
      estimate,
      rawEstimate,
      priorMean,
      priorWeight,
      observationWeight,
      tauSquared,
      tau: Math.sqrt(tauSquared),
      entries,
    };
  }

  function temporalDiagnostic(entry, options) {
    const {
      points,
      diagnosticLookbackDays,
      diagnosticFallbackDays,
      diagnosticMinimumPolls,
      diagnosticMinimumPollsters,
      outlierZThreshold,
      outlierMinimumGap,
    } = options;
    const beforeOrConcurrent = points.filter((point) => point !== entry.point && point.t <= entry.point.t);
    let referencePoints = beforeOrConcurrent.filter(
      (point) => entry.point.t - point.t <= diagnosticLookbackDays * DAY_MS,
    );
    const enoughEvidence = (candidatePoints) =>
      candidatePoints.length >= diagnosticMinimumPolls &&
      new Set(candidatePoints.map((point) => String(point.pollster || "").toLocaleLowerCase("pt-BR"))).size >=
        diagnosticMinimumPollsters;
    let lookbackDays = diagnosticLookbackDays;
    if (!enoughEvidence(referencePoints)) {
      lookbackDays = diagnosticFallbackDays;
      referencePoints = beforeOrConcurrent.filter(
        (point) => entry.point.t - point.t <= diagnosticFallbackDays * DAY_MS,
      );
    }
    if (!enoughEvidence(referencePoints)) return null;

    const reference = estimateInternal({
      ...options,
      points: referencePoints,
      allCandidatePoints: referencePoints,
      targetTime: entry.point.t,
      priorEquivalentPolls: 0,
    });
    if (!reference) return null;
    const samplingVariance = reference.entries.reduce(
      (sum, candidateEntry) => sum + candidateEntry.finalShare ** 2 * candidateEntry.seSquared,
      0,
    );
    const gap = entry.value - reference.estimate;
    const z = gap / Math.sqrt(Math.max(1e-9, entry.seSquared + reference.tauSquared + samplingVariance));
    return {
      lookbackDays,
      polls: referencePoints.length,
      pollsters: new Set(referencePoints.map((point) => point.pollster)).size,
      referenceEstimate: reference.estimate,
      gap,
      z,
      atypical: Math.abs(z) >= outlierZThreshold && Math.abs(gap) >= outlierMinimumGap,
    };
  }

  function weightedEstimateDetails(options) {
    const resolved = {
      diagnosticLookbackDays: PRODUCTION_MODEL_CONFIG.diagnosticLookbackDays,
      diagnosticFallbackDays: PRODUCTION_MODEL_CONFIG.diagnosticFallbackDays,
      diagnosticMinimumPolls: PRODUCTION_MODEL_CONFIG.diagnosticMinimumPolls,
      diagnosticMinimumPollsters: PRODUCTION_MODEL_CONFIG.diagnosticMinimumPollsters,
      outlierZThreshold: PRODUCTION_MODEL_CONFIG.outlierZThreshold,
      outlierMinimumGap: PRODUCTION_MODEL_CONFIG.outlierMinimumGap,
      legacyLeverageThreshold: PRODUCTION_MODEL_CONFIG.legacyLeverageThreshold,
      influenceThreshold: PRODUCTION_MODEL_CONFIG.influenceThreshold,
      ...options,
    };
    const result = estimateInternal(resolved);
    if (!result) return null;

    result.entries.forEach((entry) => {
      const withoutPoint = resolved.points.filter((point) => point !== entry.point);
      const leaveOneOut = withoutPoint.length
        ? estimateInternal({ ...resolved, points: withoutPoint })
        : null;
      entry.leaveOneOutEstimate = leaveOneOut?.estimate ?? result.estimate;
      entry.influence = Math.abs(result.estimate - entry.leaveOneOutEstimate);
      entry.highInfluence = entry.influence >= resolved.influenceThreshold;
      entry.highLegacyLeverage = entry.legacyShare >= resolved.legacyLeverageThreshold;
      entry.temporalDiagnostic = temporalDiagnostic(entry, resolved);
      entry.atypical = Boolean(entry.temporalDiagnostic?.atypical);
    });
    result.diagnostics = result.entries.filter(
      (entry) => entry.atypical || entry.highLegacyLeverage || entry.highInfluence,
    );
    return result;
  }

  function weightedEstimate(options) {
    return estimateInternal(options)?.estimate ?? null;
  }

  function seededRandom(seed) {
    let value = seed >>> 0;
    return () => {
      value += 0x6d2b79f5;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function normalRandom(random) {
    const u1 = Math.max(Number.EPSILON, random());
    const u2 = random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  function simulateWinProbability({
    estimate,
    sd,
    threshold = 50,
    simulations = PRODUCTION_MODEL_CONFIG.simulations,
    seed = PRODUCTION_MODEL_CONFIG.seed,
  }) {
    const random = seededRandom(seed);
    let wins = 0;
    for (let index = 0; index < simulations; index += 1) {
      if (estimate + normalRandom(random) * sd > threshold) wins += 1;
    }
    return wins / simulations;
  }

  function intervalFromDraws(values) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const quantile = (fraction) => {
      const position = fraction * (sorted.length - 1);
      const lower = Math.floor(position);
      return sorted[lower] + (sorted[Math.ceil(position)] - sorted[lower]) * (position - lower);
    };
    return { low: quantile(0.025), median: quantile(0.5), high: quantile(0.975) };
  }

  function summarizeJointDraws(first, second) {
    if (!first.length || first.length !== second.length) return null;
    const differences = first.map((value, index) => value - second[index]);
    return {
      first: intervalFromDraws(first),
      second: intervalFromDraws(second),
      difference: intervalFromDraws(differences),
      leadProbability: differences.filter((value) => value > 0).length / differences.length,
    };
  }

  function predictiveUncertainty(points, estimate, historicalSd = 0) {
    if (!points.length) {
      return {
        samplingSd: 0,
        betweenPollSd: 0,
        historicalSd,
        totalSd: historicalSd,
      };
    }

    const entries = points.map((point) => {
      const se = standardError(point);
      return { point, value: point.pct, se, seSquared: se * se };
    });
    const tauSquared = robustBetweenPollVariance(entries);
    const degrees = PRODUCTION_MODEL_CONFIG.studentTDegreesFreedom;
    const rawWeights = entries.map((entry) => {
      const variance = Math.max(1e-9, entry.seSquared + tauSquared);
      const z = (entry.value - estimate) / Math.sqrt(variance);
      const robustMultiplier = Math.min(1, (degrees + 1) / (degrees + z * z));
      return robustMultiplier / variance;
    });
    const weightSum = rawWeights.reduce((sum, weight) => sum + weight, 0) || 1;
    const normalizedWeights = rawWeights.map((weight) => weight / weightSum);
    const samplingVariance = normalizedWeights.reduce(
      (sum, weight, index) => sum + weight * weight * entries[index].seSquared,
      0,
    );
    const totalVariance = samplingVariance + tauSquared + historicalSd * historicalSd;

    return {
      samplingSd: Math.sqrt(samplingVariance),
      betweenPollSd: Math.sqrt(tauSquared),
      historicalSd,
      totalSd: Math.sqrt(totalVariance),
    };
  }

  root.ElectionModelCore = Object.freeze({
    PRODUCTION_MODEL_CONFIG,
    weightedEstimate,
    weightedEstimateDetails,
    predictiveUncertainty,
    standardError,
    simulateWinProbability,
    intervalFromDraws,
    summarizeJointDraws,
  });
})(globalThis);
