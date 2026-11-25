export interface RubricScores {
  verdict: number;
  punch: number;
  surprise: number;
  craft: number;
  recognition: number;
}

export interface SnapshotEntry {
  id: string;
  word: string;
  author: string;
  wins: number;
  losses: number;
  ties: number;
  score: number | null;
  tags: string[];
  rubric: Partial<RubricScores>;
  valid: boolean;
}

export interface SnapshotComparison {
  winner: string;
  loser: string;
  tie: boolean;
  weight: number;
}

export interface RadarSnapshot {
  id: string;
  title: string;
  bounty: string;
  asOf: string;
  entries: SnapshotEntry[];
  comparisons: SnapshotComparison[];
}

export type RadarRing = "Core" | "Contender" | "Watch" | "Outer";
export type RadarQuadrant = "Dry" | "Absurd" | "Brutal" | "Meta";

export interface BoardIssue {
  code: string;
  severity: "error" | "warn";
  message: string;
}

export interface RankedEntry {
  rank: number;
  id: string;
  word: string;
  author: string;
  valid: boolean;
  inTheMoney: boolean;
  wins: number;
  losses: number;
  ties: number;
  comparisons: number;
  winRate: number;
  survivalScore: number;
  rubricScore: number;
  score: number;
  rubric: RubricScores;
  tags: string[];
  ring: RadarRing;
  quadrant: RadarQuadrant;
  angleDeg: number;
  radius: number;
  x: number;
  y: number;
}

export interface RadarSummary {
  totalEntries: number;
  validEntries: number;
  invalidEntries: number;
  totalComparisons: number;
  leader: string | null;
  medianScore: number;
  spread: number;
  ringCounts: Record<RadarRing, number>;
  quadrantCounts: Record<RadarQuadrant, number>;
}

export interface RadarModel {
  snapshot: RadarSnapshot;
  entries: RankedEntry[];
  topFive: RankedEntry[];
  issues: BoardIssue[];
  summary: RadarSummary;
}

const MAX_WORD_LENGTH = 111;
const TOP_PAID_PLACES = 5;
const BT_ITERATIONS = 24;
const QUADRANTS: readonly RadarQuadrant[] = ["Dry", "Absurd", "Brutal", "Meta"];
const RINGS: readonly RadarRing[] = ["Core", "Contender", "Watch", "Outer"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function round4(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value * 10000) / 10000;
  return rounded === 0 ? 0 : rounded;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return value < min ? min : value > max ? max : value;
}

function toFiniteNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toCleanString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function hashFNV1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function slugify(word: string, index: number): string {
  const base = word
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return base ? `${base}-${index + 1}` : `entry-${index + 1}`;
}

function isValidOneWord(word: string): boolean {
  if (word.length === 0 || word.length > MAX_WORD_LENGTH) return false;
  if (/\s/.test(word)) return false;
  if (/[\u0000-\u001f\u007f]/.test(word)) return false;
  return true;
}

function parseRubric(raw: unknown): Partial<RubricScores> {
  if (!isRecord(raw)) return {};
  const out: Partial<RubricScores> = {};
  const keys: (keyof RubricScores)[] = [
    "verdict",
    "punch",
    "surprise",
    "craft",
    "recognition",
  ];
  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null) {
      const val = toFiniteNumber(raw[key], Number.NaN);
      if (Number.isFinite(val)) out[key] = round4(clamp(val, 0, 100));
    }
  }
  return out;
}

function normalizeEntry(raw: unknown, index: number): SnapshotEntry {
  if (typeof raw === "string") {
    const word = raw.trim();
    return {
      id: slugify(word, index),
      word,
      author: "",
      wins: 0,
      losses: 0,
      ties: 0,
      score: null,
      tags: [],
      rubric: {},
      valid: isValidOneWord(word),
    };
  }
  const obj = isRecord(raw) ? raw : {};
  const word = toCleanString(
    obj.word ?? obj.text ?? obj.label ?? obj.title ?? obj.value ?? ""
  );
  const id = toCleanString(obj.id) || slugify(word, index);
  const author = toCleanString(obj.author ?? obj.entrant ?? obj.handle ?? "");
  const wins = Math.max(0, toFiniteNumber(obj.wins, 0));
  const losses = Math.max(0, toFiniteNumber(obj.losses, 0));
  const ties = Math.max(0, toFiniteNumber(obj.ties ?? obj.draws, 0));
  const rawScore = obj.score ?? obj.rating ?? obj.elo;
  const parsedScore =
    rawScore !== undefined && rawScore !== null
      ? toFiniteNumber(rawScore, Number.NaN)
      : Number.NaN;
  const tagsRaw = Array.isArray(obj.tags)
    ? obj.tags
    : Array.isArray(obj.categories)
      ? obj.categories
      : [];
  const tags = Array.from(
    new Set(tagsRaw.map((t) => toCleanString(t)).filter((t) => t.length > 0))
  ).sort(compareText);
  const rubric = parseRubric(obj.rubric ?? obj.metrics);
  return {
    id,
    word,
    author,
    wins: round4(wins),
    losses: round4(losses),
    ties: round4(ties),
    score: Number.isFinite(parsedScore) ? round4(parsedScore) : null,
    tags,
    rubric,
    valid: isValidOneWord(word),
  };
}

function normalizeComparison(raw: unknown): SnapshotComparison | null {
  if (!isRecord(raw)) return null;
  const winner = toCleanString(raw.winner ?? raw.a ?? raw.left ?? "");
  const loser = toCleanString(raw.loser ?? raw.b ?? raw.right ?? "");
  if (!winner || !loser || winner === loser) return null;
  const tie = Boolean(raw.tie ?? raw.draw ?? false);
  const weight = clamp(toFiniteNumber(raw.weight ?? raw.margin, 1), 0.1, 10);
  return { winner, loser, tie, weight: round4(weight) };
}

export function parseSnapshot(input: unknown): RadarSnapshot {
  let raw: unknown = input;
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (trimmed === "") {
      raw = {};
    } else {
      try {
        raw = JSON.parse(trimmed);
      } catch {
        const lines = trimmed
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0);
        raw = { entries: lines };
      }
    }
  }
  if (Array.isArray(raw)) {
    raw = { entries: raw };
  }
  const obj = isRecord(raw) ? raw : {};
  const listRaw =
    obj.entries ??
    obj.items ??
    obj.submissions ??
    obj.words ??
    obj.candidates ??
    obj.board ??
    [];
  const rawEntries = Array.isArray(listRaw) ? listRaw : [];
  const seenIds = new Set<string>();
  const entries: SnapshotEntry[] = rawEntries.map((item, idx) => {
    const entry = normalizeEntry(item, idx);
    let uniqueId = entry.id;
    let suffix = 2;
    while (seenIds.has(uniqueId)) {
      uniqueId = `${entry.id}-${suffix}`;
      suffix += 1;
    }
    seenIds.add(uniqueId);
    return { ...entry, id: uniqueId };
  });

  const compRaw =
    obj.comparisons ?? obj.matches ?? obj.pairs ?? obj.duels ?? [];
  const comparisons: SnapshotComparison[] = Array.isArray(compRaw)
    ? compRaw
        .map(normalizeComparison)
        .filter((c): c is SnapshotComparison => c !== null)
    : [];

  return {
    id: toCleanString(obj.id) || "snapshot-1",
    title: toCleanString(obj.title) || "Describe Your Ex in One Word",
    bounty:
      toCleanString(obj.bounty) ||
      "u-puan-describe-your-ex-in-one-word-9fc6ebe7",
    asOf: toCleanString(obj.asOf ?? obj.generatedAt ?? obj.timestamp) || "static",
    entries,
    comparisons,
  };
}

function estimateRubric(
  word: string,
  valid: boolean,
  freq: number,
  total: number,
  provided: Partial<RubricScores>
): RubricScores {
  const lower = word.toLowerCase();
  const lettersOnly = lower.replace(/[^a-z'-]/g, "");
  const len = word.length;
  const verdictBase = !valid
    ? 10
    : len <= 20 && lettersOnly.length >= Math.max(2, Math.floor(len * 0.7))
      ? 92
      : len <= 40
        ? 78
        : 58;
  const idealDist = Math.abs(len - 9);
  const punchBase = valid ? clamp(90 - idealDist * 2.2, 35, 94) : 15;
  const rarity = total > 0 ? 1 - (freq - 1) / Math.max(1, total) : 1;
  const hashBoost = (hashFNV1a(lower) % 19) - 9;
  const surpriseBase = valid
    ? clamp(62 + rarity * 24 + hashBoost * 0.5, 30, 96)
    : 20;
  const hasHyphenOrCompound = /[-']/.test(word) ? 6 : 0;
  const vowelMatches = lower.match(/[aeiouy]+/g);
  const syllables = vowelMatches ? vowelMatches.length : 1;
  const craftBase = valid
    ? clamp(
        68 + hasHyphenOrCompound + (syllables >= 2 && syllables <= 4 ? 12 : 4),
        35,
        95
      )
    : 15;
  const recognitionBase = valid
    ? clamp(
        74 + (len >= 4 && len <= 16 ? 12 : -8) - (freq > 3 ? 6 : 0),
        30,
        94
      )
    : 20;

  return {
    verdict: round4(provided.verdict ?? verdictBase),
    punch: round4(provided.punch ?? punchBase),
    surprise: round4(provided.surprise ?? surpriseBase),
    craft: round4(provided.craft ?? craftBase),
    recognition: round4(provided.recognition ?? recognitionBase),
  };
}

function classifyQuadrant(word: string, tags: string[]): RadarQuadrant {
  const joined = `${word.toLowerCase()} ${tags.join(" ").toLowerCase()}`;
  if (/(dry|deadpan|tax|audit|invoice|beige|buffering|typo|receipt)/.test(joined)) {
    return "Dry";
  }
  if (/(absurd|feral|cryptid|gremlin|goblin|raccoon|haunted|glitch)/.test(joined)) {
    return "Absurd";
  }
  if (/(brutal|toxic|parasite|warning|redflag|disaster|caution|hazard)/.test(joined)) {
    return "Brutal";
  }
  if (/(meta|lesson|draft|beta|tutorial|prologue|footnote|subplot)/.test(joined)) {
    return "Meta";
  }
  return QUADRANTS[hashFNV1a(word.toLowerCase()) % QUADRANTS.length];
}

function classifyRing(rank: number, valid: boolean): RadarRing {
  if (!valid) return "Outer";
  if (rank <= TOP_PAID_PLACES) return "Core";
  if (rank <= 15) return "Contender";
  if (rank <= 30) return "Watch";
  return "Outer";
}

function resolveRef(
  ref: string,
  byId: Map<string, string>,
  byWord: Map<string, string>
): string | null {
  if (byId.has(ref)) return byId.get(ref) ?? null;
  const lower = ref.toLowerCase();
  if (byWord.has(lower)) return byWord.get(lower) ?? null;
  return null;
}

function computeBradleyTerry(
  entries: SnapshotEntry[],
  comparisons: SnapshotComparison[]
): {
  strengths: Map<string, number>;
  wins: Map<string, number>;
  losses: Map<string, number>;
  ties: Map<string, number>;
  resolvedComparisons: number;
} {
  const byId = new Map<string, string>();
  const byWord = new Map<string, string>();
  const wins = new Map<string, number>();
  const losses = new Map<string, number>();
  const ties = new Map<string, number>();
  const pairWins = new Map<string, number>();
  const pairLosses = new Map<string, number>();
  const pairTies = new Map<string, number>();
  const pairMatches = new Map<string, Map<string, number>>();

  for (const entry of entries) {
    byId.set(entry.id, entry.id);
    const key = entry.word.toLowerCase();
    if (key && !byWord.has(key)) byWord.set(key, entry.id);
    wins.set(entry.id, 0);
    losses.set(entry.id, 0);
    ties.set(entry.id, 0);
    pairWins.set(entry.id, 0);
    pairLosses.set(entry.id, 0);
    pairTies.set(entry.id, 0);
    pairMatches.set(entry.id, new Map<string, number>());
  }

  let resolvedComparisons = 0;
  for (const comp of comparisons) {
    const a = resolveRef(comp.winner, byId, byWord);
    const b = resolveRef(comp.loser, byId, byWord);
    if (!a || !b || a === b) continue;
    resolvedComparisons += 1;
    const w = comp.weight;
    const mapA = pairMatches.get(a)!;
    const mapB = pairMatches.get(b)!;
    mapA.set(b, (mapA.get(b) ?? 0) + w);
    mapB.set(a, (mapB.get(a) ?? 0) + w);
    if (comp.tie) {
      pairTies.set(a, (pairTies.get(a) ?? 0) + w);
      pairTies.set(b, (pairTies.get(b) ?? 0) + w);
    } else {
      pairWins.set(a, (pairWins.get(a) ?? 0) + w);
      pairLosses.set(b, (pairLosses.get(b) ?? 0) + w);
    }
  }

  const strength = new Map<string, number>();
  for (const entry of entries) {
    const pw = pairWins.get(entry.id) ?? 0;
    const pl = pairLosses.get(entry.id) ?? 0;
    const pt = pairTies.get(entry.id) ?? 0;
    wins.set(entry.id, round4(Math.max(entry.wins, pw)));
    losses.set(entry.id, round4(Math.max(entry.losses, pl)));
    ties.set(entry.id, round4(Math.max(entry.ties, pt)));
    strength.set(entry.id, 1);
  }

  const prior = 0.25;
  for (let iter = 0; iter < BT_ITERATIONS; iter += 1) {
    const next = new Map<string, number>();
    let logSum = 0;
    for (const entry of entries) {
      const id = entry.id;
      const cur = strength.get(id) ?? 1;
      const pw = pairWins.get(id) ?? 0;
      const pl = pairLosses.get(id) ?? 0;
      const pt = pairTies.get(id) ?? 0;
      const aggW = Math.max(0, (wins.get(id) ?? 0) - pw);
      const aggL = Math.max(0, (losses.get(id) ?? 0) - pl);
      const aggT = Math.max(0, (ties.get(id) ?? 0) - pt);
      const numerator = pw + aggW + 0.5 * (pt + aggT) + prior;
      let denom = (aggW + aggL + aggT + prior * 2) / (cur + 1);
      const opps = pairMatches.get(id)!;
      for (const [oppId, matchWeight] of opps.entries()) {
        denom += matchWeight / (cur + (strength.get(oppId) ?? 1));
      }
      const val = denom > 0 ? clamp(numerator / denom, 1e-4, 1e4) : 1;
      next.set(id, val);
      logSum += Math.log(val);
    }
    const geoMean = entries.length > 0 ? Math.exp(logSum / entries.length) : 1;
    for (const entry of entries) {
      strength.set(entry.id, (next.get(entry.id) ?? 1) / geoMean);
    }
  }

  const strengths = new Map<string, number>();
  for (const entry of entries) {
    const s = strength.get(entry.id) ?? 1;
    strengths.set(entry.id, round4((100 * s) / (s + 1)));
  }
  return { strengths, wins, losses, ties, resolvedComparisons };
}

function collectIssues(
  entries: RankedEntry[],
  totalComparisons: number
): BoardIssue[] {
  const issues: BoardIssue[] = [];
  const validCount = entries.filter((e) => e.valid).length;
  const invalidCount = entries.length - validCount;
  if (entries.length === 0) {
    issues.push({
      code: "EMPTY_BOARD",
      severity: "error",
      message: "Board has no entries to rank.",
    });
    return issues;
  }
  if (validCount === 0) {
    issues.push({
      code: "NO_VALID_ENTRIES",
      severity: "error",
      message:
        "Board has no valid one-word entries (non-empty, no spaces, max 111 chars).",
    });
  } else if (validCount < 2) {
    issues.push({
      code: "INSUFFICIENT_ENTRIES",
      severity: "warn",
      message: "Board needs at least 2 valid entries for pairwise ranking.",
    });
  }
  if (invalidCount > 0) {
    issues.push({
      code: "INVALID_ENTRIES",
      severity: "warn",
      message: `Board contains ${invalidCount} invalid ${invalidCount === 1 ? "entry" : "entries"} violating the one-word rule.`,
    });
  }
  if (totalComparisons === 0 && validCount >= 2) {
    issues.push({
      code: "NO_COMPARISONS",
      severity: "warn",
      message:
        "Board has no pairwise comparisons; ranking falls back to rubric scores.",
    });
  }
  return issues;
}

export function buildRadar(input: RadarSnapshot | unknown): RadarModel {
  const snapshot =
    isRecord(input) && Array.isArray(input.entries) && Array.isArray(input.comparisons)
      ? parseSnapshot(input)
      : parseSnapshot(input);

  const wordFreq = new Map<string, number>();
  for (const entry of snapshot.entries) {
    const key = entry.word.toLowerCase();
    wordFreq.set(key, (wordFreq.get(key) ?? 0) + 1);
  }

  const bt = computeBradleyTerry(snapshot.entries, snapshot.comparisons);
  const totalEntries = snapshot.entries.length;
  const preRanked = snapshot.entries.map((entry) => {
    const wins = bt.wins.get(entry.id) ?? 0;
    const losses = bt.losses.get(entry.id) ?? 0;
    const ties = bt.ties.get(entry.id) ?? 0;
    const comparisons = round4(wins + losses + ties);
    const winRate =
      comparisons > 0 ? round4((wins + 0.5 * ties) / comparisons) : 0.5;
    const survivalScore = bt.strengths.get(entry.id) ?? 50;
    const freq = wordFreq.get(entry.word.toLowerCase()) ?? 1;
    const rubric = estimateRubric(
      entry.word,
      entry.valid,
      freq,
      totalEntries,
      entry.rubric
    );
    const rubricScore = round4(
      rubric.verdict * 0.28 +
        rubric.punch * 0.24 +
        rubric.surprise * 0.18 +
        rubric.craft * 0.15 +
        rubric.recognition * 0.15
    );
    const compConfidence = clamp(comparisons / (comparisons + 4), 0, 0.85);
    const blended =
      entry.score !== null && comparisons === 0
        ? clamp(entry.score, 0, 100)
        : survivalScore * (0.15 + compConfidence * 0.7) +
          rubricScore * (0.85 - compConfidence * 0.7);
    const finalScore = round4(entry.valid ? blended : Math.min(blended, 20));
    const quadrant = classifyQuadrant(entry.word, entry.tags);
    return {
      id: entry.id,
      word: entry.word,
      author: entry.author,
      valid: entry.valid,
      wins,
      losses,
      ties,
      comparisons,
      winRate,
      survivalScore,
      rubricScore,
      score: finalScore,
      rubric,
      tags: entry.tags,
      quadrant,
    };
  });

  preRanked.sort((a, b) => {
    if (a.valid !== b.valid) return a.valid ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.losses !== b.losses) return a.losses - b.losses;
    const wordCmp = compareText(a.word.toLowerCase(), b.word.toLowerCase());
    if (wordCmp !== 0) return wordCmp;
    return compareText(a.id, b.id);
  });

  const ringCounts: Record<RadarRing, number> = {
    Core: 0,
    Contender: 0,
    Watch: 0,
    Outer: 0,
  };
  const quadrantCounts: Record<RadarQuadrant, number> = {
    Dry: 0,
    Absurd: 0,
    Brutal: 0,
    Meta: 0,
  };

  const entries: RankedEntry[] = preRanked.map((item, idx) => {
    const rank = idx + 1;
    const ring = classifyRing(rank, item.valid);
    ringCounts[ring] += 1;
    quadrantCounts[item.quadrant] += 1;
    const qIndex = QUADRANTS.indexOf(item.quadrant);
    const rIndex = RINGS.indexOf(ring);
    const jitter = (hashFNV1a(`${item.id}:${item.word}`) % 700) / 10;
    const angleDeg = round4(qIndex * 90 + 10 + jitter);
    const baseRadius = 0.14 + rIndex * 0.22;
    const scoreOffset = (1 - clamp(item.score / 100, 0, 1)) * 0.16;
    const radius = round4(clamp(baseRadius + scoreOffset, 0.08, 0.96));
    const rad = (angleDeg * Math.PI) / 180;
    return {
      ...item,
      rank,
      inTheMoney: item.valid && rank <= TOP_PAID_PLACES,
      ring,
      angleDeg,
      radius,
      x: round4(Math.cos(rad) * radius),
      y: round4(Math.sin(rad) * radius),
    };
  });

  const totalComparisons = Math.max(
    bt.resolvedComparisons,
    Math.round(entries.reduce((acc, e) => acc + e.comparisons, 0) / 2)
  );
  const validEntries = entries.filter((e) => e.valid).length;
  const scores = entries.map((e) => e.score);
  const mid = Math.floor(scores.length / 2);
  const medianScore =
    scores.length === 0
      ? 0
      : scores.length % 2 === 1
        ? scores[mid]
        : round4((scores[mid - 1] + scores[mid]) / 2);
  const spread =
    scores.length >= 2 ? round4(scores[0] - scores[scores.length - 1]) : 0;

  return {
    snapshot,
    entries,
    topFive: entries.filter((e) => e.inTheMoney),
    issues: collectIssues(entries, totalComparisons),
    summary: {
      totalEntries: entries.length,
      validEntries,
      invalidEntries: entries.length - validEntries,
      totalComparisons,
      leader: entries[0]?.valid ? entries[0].word : null,
      medianScore,
      spread,
      ringCounts,
      quadrantCounts,
    },
  };
}

export function boardIssue(
  input: RadarModel | RadarSnapshot | unknown
): string | null {
  if (isRecord(input) && Array.isArray(input.issues)) {
    const first = input.issues.find(
      (item): item is BoardIssue =>
        isRecord(item) && typeof item.message === "string"
    );
    return first ? first.message : null;
  }
  const radar = buildRadar(input);
  return radar.issues.length > 0 ? radar.issues[0].message : null;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function dataScript(data: unknown, id = "radar-data"): string {
  const serialized = JSON.stringify(data === undefined ? null : data);
  const safeJson = serialized
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  return `<script id="${escapeAttr(id)}" type="application/json">${safeJson}</script>`;
}