const PHASE_SEEDLING = 0;
const PHASE_SPROUT = 1;
const PHASE_GROWING = 2;
const PHASE_READY = 3;

const STARTING_PHASE = PHASE_SPROUT;

const MAX_SHORT_PHASE_MS = 2 * 60 * 1000;
const MAX_SHORT_PHASE_FRACTION = 0.4;
const MIN_SECOND_BREAKPOINT = 0.4;
const MAX_SECOND_BREAKPOINT = 0.95;

const fnv1aHash = (input) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < input.length; i += 1) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
};

const makeDeterministicRng = (seed) => {
    let t = seed >>> 0;
    return () => {
        t += 0x6d2b79f5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
};

export function getStageBreakpoints(plotId, cropKey, plantedAt, growTimeMs) {
    const totalMs = Number.isFinite(growTimeMs) && growTimeMs > 0 ? growTimeMs : null;
    const seedInput = `${plotId || "?"}|${cropKey || "?"}|${Number.isFinite(plantedAt) ? plantedAt : 0}|${totalMs ?? -1}`;
    const rng = makeDeterministicRng(fnv1aHash(seedInput));

    const maxFirstFraction = totalMs ? Math.min(1, MAX_SHORT_PHASE_MS / totalMs) : 0.25;
    const cappedFirstFraction = Math.min(maxFirstFraction, MAX_SHORT_PHASE_FRACTION);
    const firstBreakpoint = rng() * cappedFirstFraction;

    const minSecond = Math.max(firstBreakpoint + 0.1, MIN_SECOND_BREAKPOINT);
    const secondBreakpoint = Math.min(MAX_SECOND_BREAKPOINT, minSecond + rng() * (MAX_SECOND_BREAKPOINT - minSecond));

    return [firstBreakpoint, Math.max(secondBreakpoint, firstBreakpoint + 0.05)];
}

export function getGrowthPhase(progress, breakpoints, isReady) {
    if (isReady) return PHASE_READY;
    if (progress >= breakpoints[1]) return PHASE_READY;
    if (progress >= breakpoints[0]) return PHASE_GROWING;
    return STARTING_PHASE;
}
