export const SIM_VERSION = "0.1.0";
export const ARM_DEFINITIONS = Object.freeze([
  { id: "central", label: "Head-locked", layout: "head-only" },
  { id: "distributed", label: "Distributed", layout: "body-wide" },
]);

export const INTERVENTIONS = Object.freeze({
  head: { label: "Head regrowth", event: "head-regrowth" },
  turnover: { label: "Cell turnover", event: "cell-turnover" },
  graft: { label: "Yoked-twin graft", event: "cross-graft" },
  sham: { label: "Sham", event: "sham" },
});

const CELL_COUNT = 12;
const HEAD_COUNT = 3;
const ORGANISMS_PER_REPLICATE = 6;
const TRAINING_EVENTS = 24;
const TEST_EVENTS = 24;

export function normalizeConfig(input) {
  const seed = Math.floor(Number(input.seed));
  const replicates = Math.floor(Number(input.replicates));
  const fidelity = Math.round(Number(input.fidelity) / 5) * 5;
  const noise = Number(input.noise ?? 0.05);
  const training = ["paired", "unpaired", "reversed"].includes(input.training) ? input.training : "paired";
  const intervention = Object.hasOwn(INTERVENTIONS, input.intervention) ? input.intervention : "head";
  return {
    simVersion: SIM_VERSION,
    seed: Number.isFinite(seed) ? Math.max(1, Math.min(2_147_483_646, seed)) : 82_417,
    replicates: Number.isFinite(replicates) ? Math.max(4, Math.min(40, replicates)) : 16,
    fidelity: Number.isFinite(fidelity) ? Math.max(0, Math.min(100, fidelity)) : 90,
    noise: Number.isFinite(noise) ? Math.max(0, Math.min(0.5, noise)) : 0.05,
    training,
    intervention,
  };
}

export function designId(config) {
  const canonical = JSON.stringify(normalizeConfig(config));
  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i += 1) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0").toUpperCase();
}

function rng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function shuffled(items, random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function trainingTarget(cue, mode) {
  const learned = cue === 0 ? 1 : -1;
  return mode === "reversed" ? -learned : learned;
}

function makeSchedule(seed, config) {
  const random = rng(seed ^ 0xa5a5a5a5);
  const cues = shuffled(Array.from({ length: TRAINING_EVENTS }, (_, index) => index % 2), random);
  let outcomes;
  if (config.training === "unpaired") {
    outcomes = Array(TRAINING_EVENTS).fill(0);
    for (const cue of [0, 1]) {
      const positions = cues.map((value, index) => value === cue ? index : -1).filter(index => index >= 0);
      const balanced = shuffled([...Array(positions.length / 2).fill(1), ...Array(positions.length / 2).fill(-1)], random);
      positions.forEach((position, index) => { outcomes[position] = balanced[index]; });
    }
  } else {
    outcomes = cues.map(cue => trainingTarget(cue, config.training));
  }

  const testCues = shuffled(Array.from({ length: TEST_EVENTS }, (_, index) => index % 2), random);
  const worlds = testCues.map(cue => ({
    cue,
    mapping: random() * 100 < config.fidelity ? trainingTarget(cue, config.training) : -trainingTarget(cue, config.training),
  }));
  const interventionOrders = Array.from({ length: ORGANISMS_PER_REPLICATE }, () => shuffled(Array.from({ length: CELL_COUNT }, (_, i) => i), random));
  const cohortOrders = Array.from({ length: TEST_EVENTS }, () => shuffled(Array.from({ length: ORGANISMS_PER_REPLICATE }, (_, i) => i), random));
  const testUniforms = Array.from({ length: ORGANISMS_PER_REPLICATE }, () => Array.from({ length: TEST_EVENTS }, random));
  const memoryNoise = Array.from({ length: ORGANISMS_PER_REPLICATE }, () => Array.from({ length: TEST_EVENTS + 2 }, () => (random() * 2 - 1)));

  return { cues, outcomes, worlds, interventionOrders, cohortOrders, testUniforms, memoryNoise };
}

function blankCell({ regrown = false } = {}) {
  return { alive: true, regrown, replaced: false, sums: [0, 0], counts: [0, 0] };
}

function memoryCellsFor(arm) {
  return arm === "central" ? [0, 1, 2] : Array.from({ length: CELL_COUNT - HEAD_COUNT }, (_, index) => index + HEAD_COUNT);
}

function accumulate(cell, cue, value) {
  cell.sums[cue] += value;
  cell.counts[cue] += 1;
}

function cellTrace(cell, cue) {
  if (!cell?.alive) return 0;
  return cell.sums[cue] / (cell.counts[cue] + 2);
}

function traceFor(cells, memoryIndices, cue, agentNoise) {
  const carriers = memoryIndices.map(index => cells[index]).filter(cell => cell?.alive);
  if (!carriers.length) return 0;
  const average = carriers.reduce((sum, cell) => sum + cellTrace(cell, cue), 0) / carriers.length;
  return Math.max(-1, Math.min(1, average + agentNoise));
}

function intervene(cells, arm, config, schedule, agentIndex, donor) {
  const memoryIndices = memoryCellsFor(arm);
  const order = schedule.interventionOrders[agentIndex];
  if (config.intervention === "head") {
    for (let index = 0; index < HEAD_COUNT; index += 1) cells[index] = blankCell({ regrown: true });
  } else if (config.intervention === "turnover") {
    const replacements = new Set(order.slice(0, Math.ceil(CELL_COUNT * 0.25)));
    for (const index of replacements) cells[index] = blankCell({ regrown: true });
  } else if (config.intervention === "graft") {
    const chosen = order.filter(index => memoryIndices.includes(index));
    const graftCount = Math.max(1, Math.ceil(memoryIndices.length * 0.4));
    for (const index of chosen.slice(0, graftCount)) {
      cells[index] = {
        alive: true,
        regrown: false,
        replaced: true,
        sums: [...donor[index].sums],
        counts: [...donor[index].counts],
      };
    }
  }
  return memoryIndices;
}

function trainCells(arm, schedule) {
  const cells = Array.from({ length: CELL_COUNT }, () => blankCell());
  const carriers = memoryCellsFor(arm);
  schedule.cues.forEach((cue, eventIndex) => {
    for (const index of carriers) accumulate(cells[index], cue, schedule.outcomes[eventIndex]);
  });
  return { cells, carriers };
}

function baselineSignal(cells, carriers, mode) {
  const target0 = mode === "unpaired" ? 0 : trainingTarget(0, mode);
  const target1 = mode === "unpaired" ? 0 : trainingTarget(1, mode);
  const first = carriers.reduce((sum, index) => sum + cellTrace(cells[index], 0) * target0, 0) / carriers.length;
  const second = carriers.reduce((sum, index) => sum + cellTrace(cells[index], 1) * target1, 0) / carriers.length;
  return (first + second) / 2;
}

function simulateAgent(arm, config, schedule, agentIndex) {
  const learned = trainCells(arm, schedule);
  const before = baselineSignal(learned.cells, learned.carriers, config.training);
  const twin = trainCells(arm, { ...schedule, outcomes: schedule.outcomes.map(value => -value) });
  const memoryIndices = intervene(learned.cells, arm, config, schedule, agentIndex, twin.cells);
  const matchedNoise = schedule.memoryNoise[agentIndex];
  const traceNoise = config.noise * 0.18;
  const after0 = traceFor(learned.cells, memoryIndices, 0, matchedNoise[0] * traceNoise);
  const after1 = traceFor(learned.cells, memoryIndices, 1, matchedNoise[1] * traceNoise);
  const target0 = config.training === "unpaired" ? 0 : trainingTarget(0, config.training);
  const target1 = config.training === "unpaired" ? 0 : trainingTarget(1, config.training);
  const postSignal = (after0 * target0 + after1 * target1) / 2;
  const retention = Math.abs(before) < 0.08 ? null : (postSignal / before) * 100;

  const byExposure = [];

  schedule.worlds.forEach((world, exposure) => {
    const noise0 = matchedNoise[exposure + 2] * traceNoise;
    const trace = traceFor(learned.cells, memoryIndices, world.cue, noise0);
    const learnedDirection = config.training === "unpaired"
      ? (world.cue === 0 ? 1 : -1)
      : trainingTarget(world.cue, config.training);
    const alignment = Math.max(-1, Math.min(1, trace * learnedDirection));
    const confidence = 0.5 + 0.42 * Math.tanh(alignment * 2.4);
    const probabilityCorrect = world.mapping === learnedDirection ? confidence : 1 - confidence;
    const wasCorrect = schedule.testUniforms[agentIndex][exposure] < probabilityCorrect;
    byExposure.push({ correct: Number(wasCorrect), prediction: probabilityCorrect, alive: 1 });
  });

  return {
    retention: retention === null ? null : Math.max(-200, Math.min(200, retention)),
    correct: 0,
    choiceCount: 0,
    accuracy: 0,
    alive: 1,
    finalEnergy: 0.62,
    brier: 1,
    brierSum: 0,
    foodFinds: 0,
    byExposure,
    cells: learned.cells,
    postTraces: [after0, after1],
    carrierCount: memoryIndices.filter(index => learned.cells[index]?.alive).length,
  };
}

function runSharedEcology(agents, schedule) {
  let foodStock = 2.4;
  for (let exposure = 0; exposure < TEST_EVENTS; exposure += 1) {
    const world = schedule.worlds[exposure];
    foodStock = Math.min(3.2, foodStock + (world.mapping > 0 ? 0.55 : 0.2));
    for (const agentIndex of schedule.cohortOrders[exposure]) {
      const agent = agents[agentIndex];
      const event = agent.byExposure[exposure];
      if (!agent.alive) {
        agent.byExposure[exposure] = null;
        continue;
      }
      agent.choiceCount += 1;
      if (event.correct) agent.correct += 1;
      agent.brierSum += (event.prediction - event.correct) ** 2;
      let energy = agent.finalEnergy - 0.006;
      if (world.mapping > 0) {
        if (event.correct && foodStock >= 1) {
          foodStock -= 1;
          agent.foodFinds += 1;
          energy += 0.12;
        } else if (event.correct) {
          energy -= 0.025;
        } else {
          energy -= 0.005;
        }
      } else if (event.correct) {
        energy += 0.004;
      } else {
        energy -= 0.12;
      }
      agent.finalEnergy = Math.max(0, Math.min(1, energy));
      if (agent.finalEnergy < 0.065) agent.alive = 0;
      agent.byExposure[exposure] = { ...event, alive: agent.alive };
    }
  }
  for (const agent of agents) {
    agent.accuracy = agent.choiceCount ? agent.correct / agent.choiceCount : 0;
    agent.brier = agent.choiceCount ? agent.brierSum / agent.choiceCount : 1;
  }
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function percentile(sorted, fraction) {
  if (!sorted.length) return null;
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] * (upper - position) + sorted[upper] * (position - lower);
}

function pairedInterval(values, seed) {
  if (values.length < 2) return [null, null];
  const random = rng(seed ^ 0x3c6ef372);
  const draws = 1600;
  const estimates = new Array(draws);
  for (let draw = 0; draw < draws; draw += 1) {
    let total = 0;
    for (let i = 0; i < values.length; i += 1) total += values[Math.floor(random() * values.length)];
    estimates[draw] = total / values.length;
  }
  estimates.sort((a, b) => a - b);
  return [percentile(estimates, 0.025), percentile(estimates, 0.975)];
}

function summarizeRows(rows, seed) {
  const central = rows.filter(row => row.arm === "central");
  const distributed = rows.filter(row => row.arm === "distributed");
  const paired = new Map(central.map(row => [row.seed, row]));
  const differences = distributed.map(row => row.accuracy - (paired.get(row.seed)?.accuracy ?? row.accuracy));
  const retentionDifferences = distributed.map(row => (row.retention ?? 0) - (paired.get(row.seed)?.retention ?? 0));
  const survivalDifferences = distributed.map(row => row.survival - (paired.get(row.seed)?.survival ?? row.survival));
  const choiceCI = pairedInterval(differences, seed);
  const retentionCI = pairedInterval(retentionDifferences, seed ^ 0x71374491);
  const survivalCI = pairedInterval(survivalDifferences, seed ^ 0xb5c0fbcf);
  return {
    central: {
      accuracy: mean(central.map(row => row.accuracy)),
      retention: mean(central.map(row => row.retention).filter(value => value !== null)),
      survival: mean(central.map(row => row.survival)),
      brier: mean(central.map(row => row.brier)),
      foodFinds: mean(central.map(row => row.foodFinds)),
    },
    distributed: {
      accuracy: mean(distributed.map(row => row.accuracy)),
      retention: mean(distributed.map(row => row.retention).filter(value => value !== null)),
      survival: mean(distributed.map(row => row.survival)),
      brier: mean(distributed.map(row => row.brier)),
      foodFinds: mean(distributed.map(row => row.foodFinds)),
    },
    choiceDelta: mean(differences),
    choiceCI,
    retentionDelta: mean(retentionDifferences),
    retentionCI,
    survivalDelta: mean(survivalDifferences),
    survivalCI,
  };
}

export async function runStudy(inputConfig, onProgress = () => {}) {
  const config = normalizeConfig(inputConfig);
  const id = designId(config);
  const rows = [];
  const tissue = {};
  const profile = {
    central: Array.from({ length: TEST_EVENTS }, () => ({ correct: 0, predicted: 0, count: 0 })),
    distributed: Array.from({ length: TEST_EVENTS }, () => ({ correct: 0, predicted: 0, count: 0 })),
  };

  for (let replicate = 0; replicate < config.replicates; replicate += 1) {
    const seed = (config.seed + Math.imul(replicate, 104_729)) >>> 0;
    const schedule = makeSchedule(seed, config);
    for (const arm of ["central", "distributed"]) {
      const agents = Array.from({ length: ORGANISMS_PER_REPLICATE }, (_, agentIndex) => simulateAgent(arm, config, schedule, agentIndex));
      runSharedEcology(agents, schedule);
      const retentionValues = agents.map(agent => agent.retention).filter(value => value !== null);
      const row = {
        protocolId: id,
        seed,
        replicate,
        arm,
        layout: arm === "central" ? "head-only" : "body-wide",
        intervention: config.intervention,
        interventionEvent: INTERVENTIONS[config.intervention].event,
        training: config.training,
        fidelity: config.fidelity,
        accuracy: mean(agents.map(agent => agent.accuracy)),
        retention: mean(retentionValues),
        retentionValid: retentionValues.length === agents.length,
        survival: mean(agents.map(agent => agent.alive)),
        brier: mean(agents.map(agent => agent.brier)),
        energy: mean(agents.map(agent => agent.finalEnergy)),
        foodFinds: agents.reduce((sum, agent) => sum + agent.foodFinds, 0),
        organisms: agents.length,
        totalChoices: agents.reduce((sum, agent) => sum + agent.choiceCount, 0),
        correctChoices: agents.reduce((sum, agent) => sum + agent.correct, 0),
        fate: mean(agents.map(agent => agent.alive)) > 0.7 ? "alive" : mean(agents.map(agent => agent.alive)) > 0 ? "mixed" : "extinct",
      };
      rows.push(row);
      agents.forEach(agent => agent.byExposure.forEach((value, exposure) => {
        if (!value) return;
        profile[arm][exposure].correct += value.correct;
        profile[arm][exposure].predicted += value.prediction;
        profile[arm][exposure].count += 1;
      }));
      if (replicate === 0) {
        tissue[arm] = {
          cells: agents[0].cells.map(cell => ({
            alive: cell.alive,
            regrown: cell.regrown,
            replaced: cell.replaced,
            signal: (cellTrace(cell, 0) - cellTrace(cell, 1)) / 2,
          })),
          traces: agents[0].postTraces,
          carrierCount: agents[0].carrierCount,
        };
      }
    }
    onProgress({ completed: replicate + 1, total: config.replicates, seed });
    await new Promise(resolve => setTimeout(resolve, 20));
  }

  const exposureProfile = Object.fromEntries(Object.entries(profile).map(([arm, values]) => [arm, values.map((value, index) => ({
    exposure: index + 1,
    accuracy: value.count ? value.correct / value.count : null,
    predicted: value.count ? value.predicted / value.count : null,
    n: value.count,
  }))]));

  return {
    simVersion: SIM_VERSION,
    protocolId: id,
    config,
    organismCount: config.replicates * ORGANISMS_PER_REPLICATE * 2,
    rows,
    summary: summarizeRows(rows, config.seed),
    exposureProfile,
    tissue,
    generatedAt: new Date().toISOString(),
  };
}
