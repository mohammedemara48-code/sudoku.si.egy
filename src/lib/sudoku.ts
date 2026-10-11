export type Grid = number[];

export const LEVELS = [
  { id: "easy", label: "سهل", clues: 40 },
  { id: "mid", label: "متوسط", clues: 32 },
  { id: "hard", label: "صعب", clues: 28 },
  { id: "expert", label: "خبير", clues: 24 },
] as const;

export type LevelId = (typeof LEVELS)[number]["id"];

export function levelById(id: LevelId) {
  return LEVELS.find((level) => level.id === id) ?? LEVELS[1];
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = arr[i] as T;
    const b = arr[j] as T;
    arr[i] = b;
    arr[j] = a;
  }
  return arr;
}

export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function weekSeed(date = new Date()): number {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return utc.getUTCFullYear() * 100 + week;
}

function fits(grid: Grid, index: number, value: number): boolean {
  const row = Math.floor(index / 9);
  const col = index % 9;
  for (let k = 0; k < 9; k++) {
    if (grid[row * 9 + k] === value || grid[k * 9 + col] === value) return false;
  }
  const boxRow = row - (row % 3);
  const boxCol = col - (col % 3);
  for (let dr = 0; dr < 3; dr++) {
    for (let dc = 0; dc < 3; dc++) {
      if (grid[(boxRow + dr) * 9 + boxCol + dc] === value) return false;
    }
  }
  return true;
}

function fill(grid: Grid, rng: () => number): boolean {
  const index = grid.indexOf(0);
  if (index < 0) return true;
  for (const value of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng)) {
    if (!fits(grid, index, value)) continue;
    grid[index] = value;
    if (fill(grid, rng)) return true;
    grid[index] = 0;
  }
  return false;
}

function countSolutions(grid: Grid, limit = 2): number {
  let found = 0;
  const walk = () => {
    if (found >= limit) return;
    let best = -1;
    let choices: number[] | null = null;
    for (let i = 0; i < 81; i++) {
      if (grid[i]) continue;
      const options: number[] = [];
      for (let value = 1; value <= 9; value++) {
        if (fits(grid, i, value)) options.push(value);
      }
      if (!options.length) return;
      if (!choices || options.length < choices.length) {
        choices = options;
        best = i;
        if (options.length === 1) break;
      }
    }
    if (best < 0 || !choices) {
      found += 1;
      return;
    }
    for (const value of choices) {
      grid[best] = value;
      walk();
      grid[best] = 0;
      if (found >= limit) return;
    }
  };
  walk();
  return found;
}

export function generatePuzzle(clues: number, rng: () => number = Math.random) {
  const solution = Array<number>(81).fill(0);
  fill(solution, rng);
  const puzzle = solution.slice();
  for (const index of shuffle([...Array(81).keys()], rng)) {
    if (puzzle.filter(Boolean).length <= clues) break;
    const previous = puzzle[index] ?? 0;
    puzzle[index] = 0;
    if (countSolutions(puzzle.slice()) !== 1) puzzle[index] = previous;
  }
  return { solution, puzzle };
}

export function hasConflict(grid: Grid, index: number): boolean {
  const value = grid[index];
  if (!value) return false;
  const row = Math.floor(index / 9);
  const col = index % 9;
  for (let k = 0; k < 9; k++) {
    if (k !== col && grid[row * 9 + k] === value) return true;
    if (k !== row && grid[k * 9 + col] === value) return true;
  }
  const boxRow = row - (row % 3);
  const boxCol = col - (col % 3);
  for (let dr = 0; dr < 3; dr++) {
    for (let dc = 0; dc < 3; dc++) {
      const peer = (boxRow + dr) * 9 + boxCol + dc;
      if (peer !== index && grid[peer] === value) return true;
    }
  }
  return false;
}

export function peerOf(a: number, b: number): boolean {
  if (a < 0 || b < 0 || a === b) return false;
  const rowA = Math.floor(a / 9);
  const colA = a % 9;
  const rowB = Math.floor(b / 9);
  const colB = b % 9;
  if (rowA === rowB || colA === colB) return true;
  return rowA - (rowA % 3) === rowB - (rowB % 3) && colA - (colA % 3) === colB - (colB % 3);
}

export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export function clearPeerNotes(notes: number[][], index: number, value: number): number[][] {
  const next = notes.map((entry) => entry.slice());
  const row = Math.floor(index / 9);
  const col = index % 9;
  const drop = (cell: number) => {
    next[cell] = (next[cell] ?? []).filter((note) => note !== value);
  };
  for (let k = 0; k < 9; k++) {
    drop(row * 9 + k);
    drop(k * 9 + col);
  }
  const boxRow = row - (row % 3);
  const boxCol = col - (col % 3);
  for (let dr = 0; dr < 3; dr++) {
    for (let dc = 0; dc < 3; dc++) drop((boxRow + dr) * 9 + boxCol + dc);
  }
  return next;
}
