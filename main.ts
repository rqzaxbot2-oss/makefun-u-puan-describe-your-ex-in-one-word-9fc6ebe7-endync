import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const BOUNTY_ID = "u-puan-describe-your-ex-in-one-word-9fc6ebe7";
export const BOUNTY_TITLE = "Describe Your Ex in One Word";
export const HARNESS = "program/v1";
export const MAX_WORD_LENGTH = 111;
export const ENTRY_WORD = "Timeshare";

export interface WordValidation {
  word: string;
  valid: boolean;
  characterCount: number;
  maxCharacters: number;
  singleWord: boolean;
  lettersOnly: boolean;
  trimmed: boolean;
}

export interface RubricSignal {
  criterion: string;
  weightOrder: number;
  summary: string;
}

export interface DossierPayload {
  schema: "makefun.dossier/1";
  bountyId: string;
  bountyTitle: string;
  harness: string;
  word: string;
  sha256: string;
  validation: WordValidation;
  rubric: RubricSignal[];
}

export interface ArtifactEntry {
  file: string;
  bytes: number;
  sha256: string;
}

export interface BoardPayload {
  schema: "makefun.board/1";
  bountyId: string;
  bountyTitle: string;
  harness: string;
  entry: {
    word: string;
    characterCount: number;
    maxCharacters: number;
    valid: boolean;
    digest: string;
  };
  artifacts: ArtifactEntry[];
}

export interface RunOptions {
  outDir?: string;
  word?: string;
  silent?: boolean;
}

export interface RunResult {
  word: string;
  outDir: string;
  board: BoardPayload;
  dossier: DossierPayload;
  files: string[];
}

function compareAscii(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeScriptJson(json: string): string {
  return json
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function assertSafeFilename(name: string): void {
  if (
    typeof name !== "string" ||
    name.length === 0 ||
    name === "." ||
    name === ".." ||
    name.includes("\0") ||
    name.includes("/") ||
    name.includes("\\") ||
    path.basename(name) !== name
  ) {
    throw new Error(`Unsafe artifact filename: ${String(name)}`);
  }
}

function describeValidationFailure(validation: WordValidation): string {
  const reasons: string[] = [];
  if (validation.characterCount === 0) {
    reasons.push("must not be empty");
  }
  if (validation.characterCount > validation.maxCharacters) {
    reasons.push(`exceeds ${validation.maxCharacters} characters`);
  }
  if (!validation.trimmed) {
    reasons.push("must not have leading or trailing whitespace");
  }
  if (!validation.singleWord && validation.characterCount > 0) {
    reasons.push("must be a single word without whitespace");
  }
  if (!validation.lettersOnly && validation.characterCount > 0) {
    reasons.push("must contain ASCII letters only");
  }
  return reasons.length > 0 ? reasons.join("; ") : "failed validation";
}

export function validateWord(word: string): WordValidation {
  const safeWord = typeof word === "string" ? word : "";
  const trimmed = safeWord === safeWord.trim();
  const characterCount = Array.from(safeWord).length;
  const singleWord = characterCount > 0 && !/\s/.test(safeWord);
  const lettersOnly = /^[A-Za-z]+$/.test(safeWord);
  const valid =
    typeof word === "string" &&
    trimmed &&
    singleWord &&
    lettersOnly &&
    characterCount >= 1 &&
    characterCount <= MAX_WORD_LENGTH;

  return {
    word: safeWord,
    valid,
    characterCount,
    maxCharacters: MAX_WORD_LENGTH,
    singleWord,
    lettersOnly,
    trimmed,
  };
}

export function buildDossier(word: string = ENTRY_WORD): DossierPayload {
  const validation = validateWord(word);
  if (!validation.valid) {
    const reason = describeValidationFailure(validation);
    throw new Error(`Invalid one-word entry: "${String(word)}" (${reason})`);
  }

  return {
    schema: "makefun.dossier/1",
    bountyId: BOUNTY_ID,
    bountyTitle: BOUNTY_TITLE,
    harness: HARNESS,
    word,
    sha256: sha256(word),
    validation,
    rubric: [
      {
        criterion: "One-word verdict on an ex",
        weightOrder: 1,
        summary: "Single unhyphenated noun delivering a complete retrospective judgment.",
      },
      {
        criterion: "Comic punch",
        weightOrder: 2,
        summary: "Instant deadpan indictment of a regretful commitment with hidden upkeep.",
      },
      {
        criterion: "Surprise",
        weightOrder: 3,
        summary: "Unexpected real-estate trap framing that sidesteps standard breakup cliches.",
      },
      {
        criterion: "Craft",
        weightOrder: 4,
        summary: "Double resonance: hard to exit, costly to maintain, and suspiciously shared.",
      },
      {
        criterion: "Recognition",
        weightOrder: 5,
        summary: "Universal shorthand for an alluring sales pitch that became a binding mistake.",
      },
    ],
  };
}

export function renderCss(): string {
  return [
    ":root {",
    "  --bg: #0f1115;",
    "  --panel: #181c24;",
    "  --border: #2a3140;",
    "  --ink: #f3f5f8;",
    "  --muted: #9aa4b5;",
    "  --accent: #f4b860;",
    "}",
    "* { box-sizing: border-box; }",
    "body {",
    "  margin: 0;",
    "  min-height: 100vh;",
    "  display: grid;",
    "  place-items: center;",
    "  padding: 24px;",
    "  background: radial-gradient(circle at top, #1b2130 0%, var(--bg) 68%);",
    "  color: var(--ink);",
    "  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;",
    "}",
    ".card {",
    "  width: min(640px, 100%);",
    "  background: var(--panel);",
    "  border: 1px solid var(--border);",
    "  border-radius: 16px;",
    "  padding: 36px 32px;",
    "  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);",
    "}",
    ".eyebrow {",
    "  margin: 0 0 12px;",
    "  font-size: 12px;",
    "  letter-spacing: 0.14em;",
    "  text-transform: uppercase;",
    "  color: var(--muted);",
    "}",
    ".verdict {",
    "  margin: 0 0 16px;",
    "  font-size: clamp(44px, 9vw, 72px);",
    "  line-height: 1.04;",
    "  letter-spacing: -0.03em;",
    "  overflow-wrap: anywhere;",
    "  color: var(--accent);",
    "}",
    ".meta {",
    "  margin: 0 0 24px;",
    "  font-size: 14px;",
    "  color: var(--muted);",
    "}",
    ".rubric {",
    "  list-style: none;",
    "  margin: 0;",
    "  padding: 20px 0 0;",
    "  border-top: 1px solid var(--border);",
    "  display: grid;",
    "  gap: 12px;",
    "}",
    ".rubric li {",
    "  font-size: 14px;",
    "  line-height: 1.45;",
    "}",
    ".rubric strong {",
    "  color: var(--ink);",
    "}",
    ".rubric span {",
    "  color: var(--muted);",
    "}",
    "",
  ].join("\n");
}

export function renderHtml(dossier: DossierPayload): string {
  const safeWord = escapeHtml(dossier.word);
  const safeTitle = escapeHtml(dossier.bountyTitle);
  const orderedRubric = [...dossier.rubric].sort(
    (a, b) => a.weightOrder - b.weightOrder || compareAscii(a.criterion, b.criterion)
  );
  const items = orderedRubric
    .map(
      (item) =>
        `        <li><strong>${escapeHtml(item.criterion)}:</strong> <span>${escapeHtml(item.summary)}</span></li>`
    )
    .join("\n");

  return [
    "<!doctype html>",
    '<html lang="en">',
    "  <head>",
    '    <meta charset="utf-8">',
    '    <meta name="viewport" content="width=device-width, initial-scale=1">',
    `    <title>${safeWord} - ${safeTitle}</title>`,
    '    <link rel="stylesheet" href="./styles.css">',
    "  </head>",
    "  <body>",
    '    <main class="card">',
    `      <p class="eyebrow">${safeTitle}</p>`,
    `      <h1 class="verdict" id="entry-word">${safeWord}</h1>`,
    `      <p class="meta">${dossier.validation.characterCount} / ${dossier.validation.maxCharacters} characters &middot; single-word verdict</p>`,
    '      <ol class="rubric">',
    items,
    "      </ol>",
    "    </main>",
    '    <script src="./data.js"></script>',
    "  </body>",
    "</html>",
    "",
  ].join("\n");
}

export function buildBoard(
  dossier: DossierPayload,
  fileContents: Record<string, string>
): BoardPayload {
  const artifactNames = Object.keys(fileContents).sort(compareAscii);
  const artifacts: ArtifactEntry[] = artifactNames.map((file) => {
    assertSafeFilename(file);
    const content = fileContents[file];
    if (typeof content !== "string") {
      throw new Error(`Artifact content for "${file}" must be a string`);
    }
    return {
      file,
      bytes: Buffer.byteLength(content, "utf8"),
      sha256: sha256(content),
    };
  });

  return {
    schema: "makefun.board/1",
    bountyId: dossier.bountyId,
    bountyTitle: dossier.bountyTitle,
    harness: dossier.harness,
    entry: {
      word: dossier.word,
      characterCount: dossier.validation.characterCount,
      maxCharacters: dossier.validation.maxCharacters,
      valid: dossier.validation.valid,
      digest: dossier.sha256,
    },
    artifacts,
  };
}

export function renderDataJs(
  board: BoardPayload,
  dossier: DossierPayload
): string {
  const payload = escapeScriptJson(JSON.stringify({ board, dossier }, null, 2));
  return `window.__MAKEFUN_DATA__ = ${payload};\n`;
}

export function buildArtifacts(word: string = ENTRY_WORD): {
  board: BoardPayload;
  dossier: DossierPayload;
  files: Record<string, string>;
} {
  const dossier = buildDossier(word);
  const baseFiles: Record<string, string> = {
    "dossier.json": `${JSON.stringify(dossier, null, 2)}\n`,
    "index.html": renderHtml(dossier),
    "styles.css": renderCss(),
    "word.txt": `${dossier.word}\n`,
  };

  const board = buildBoard(dossier, baseFiles);
  const files: Record<string, string> = {
    ...baseFiles,
    "board.json": `${JSON.stringify(board, null, 2)}\n`,
    "data.js": renderDataJs(board, dossier),
  };

  return { board, dossier, files };
}

export function resolveOutputDir(explicitDir?: string): string {
  const fromArg = typeof explicitDir === "string" ? explicitDir.trim() : "";
  if (fromArg.includes("\0")) {
    throw new Error("Output directory path contains a NUL byte");
  }
  if (fromArg.length > 0) {
    return path.resolve(fromArg);
  }

  const envValue = process.env.MAKEFUN_OUTPUT_DIR;
  const fromEnv = typeof envValue === "string" ? envValue.trim() : "";
  if (fromEnv.includes("\0")) {
    throw new Error("MAKEFUN_OUTPUT_DIR contains a NUL byte");
  }
  if (fromEnv.length > 0) {
    return path.resolve(fromEnv);
  }

  return path.resolve(process.cwd(), "out");
}

export function writeOutputs(
  outDir: string,
  word: string = ENTRY_WORD
): { board: BoardPayload; dossier: DossierPayload; files: string[] } {
  if (typeof outDir !== "string" || outDir.trim().length === 0 || outDir.includes("\0")) {
    throw new Error("Output directory must be a non-empty valid path");
  }

  const targetDir = path.resolve(outDir);
  const { board, dossier, files } = buildArtifacts(word);

  let existingStat: fs.Stats | null = null;
  try {
    existingStat = fs.statSync(targetDir);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      throw err;
    }
  }

  if (existingStat && !existingStat.isDirectory()) {
    throw new Error(`Output path exists and is not a directory: ${targetDir}`);
  }

  fs.mkdirSync(targetDir, { recursive: true });

  const sortedNames = Object.keys(files).sort(compareAscii);
  for (const name of sortedNames) {
    assertSafeFilename(name);
    const destination = path.resolve(targetDir, name);
    if (path.dirname(destination) !== targetDir) {
      throw new Error(`Resolved artifact path escapes output directory: ${name}`);
    }
    fs.writeFileSync(destination, files[name], "utf8");
  }

  return { board, dossier, files: sortedNames };
}

export function run(options: RunOptions = {}): RunResult {
  const word = options.word ?? ENTRY_WORD;
  const outDir = resolveOutputDir(options.outDir);
  const { board, dossier, files } = writeOutputs(outDir, word);

  if (!options.silent) {
    process.stdout.write(`${word}\n`);
  }

  return { word, outDir, board, dossier, files };
}

export function main(): void {
  run();
}

function isEntrypoint(): boolean {
  const invoked = process.argv[1];
  if (!invoked) {
    return false;
  }
  const selfPath = fileURLToPath(import.meta.url);
  try {
    return fs.realpathSync(invoked) === fs.realpathSync(selfPath);
  } catch {
    return path.resolve(invoked) === path.resolve(selfPath);
  }
}

if (isEntrypoint()) {
  try {
    main();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  }
}