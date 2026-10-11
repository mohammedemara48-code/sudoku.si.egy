import { useEffect, useRef, useState } from "react";
import { UserButton } from "@/lib/auth/gates";
import {
  LEVELS,
  clearPeerNotes,
  formatClock,
  generatePuzzle,
  hasConflict,
  levelById,
  mulberry32,
  peerOf,
  weekSeed,
  type Grid,
  type LevelId,
} from "@/lib/sudoku";
import { listWeekly, submitWeekly, type WeeklyRow } from "@/lib/weekly";

type Mode = "free" | "weekly";

type DeskState = {
  mode: Mode;
  level: LevelId;
  solution: Grid;
  grid: Grid;
  notes: number[][];
  given: boolean[];
  helped: boolean[];
  sel: number;
  notesMode: boolean;
  elapsed: number;
  running: boolean;
  done: boolean;
  status: "" | "ok" | "bad" | "win";
  message: string;
  hintsLeft: number;
};

const SAVE_KEY = "sudoku-desk-v2";
const BEST_KEY = "sudoku-bests-v2";

const STATIONS = [
  { id: "nagham", name: "نغم", url: "https://ahmsamir.radioca.st/stream" },
  { id: "mars", name: "مارس", url: "https://radiomars.ice.infomaniak.ch/radiomars-128.mp3" },
  { id: "hit", name: "هيت", url: "https://mgharba.ice.infomaniak.ch/mgharba-128.mp3" },
  { id: "hala", name: "هلا", url: "https://lbigroup.radioca.st/stream" },
] as const;

function blankNotes(): number[][] {
  return Array.from({ length: 81 }, () => []);
}

function fresh(mode: Mode, level: LevelId, week: number): DeskState {
  const clues = mode === "weekly" ? 24 : levelById(level).clues;
  const rng = mode === "weekly" ? mulberry32(week) : Math.random;
  const { solution, puzzle } = generatePuzzle(clues, rng);
  return {
    mode,
    level: mode === "weekly" ? "expert" : level,
    solution,
    grid: puzzle.slice(),
    notes: blankNotes(),
    given: puzzle.map((value) => value !== 0),
    helped: Array(81).fill(false),
    sel: -1,
    notesMode: false,
    elapsed: 0,
    running: true,
    done: false,
    status: "",
    message: "",
    hintsLeft: mode === "weekly" ? 0 : 3,
  };
}

function readBests(): Record<string, number> {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function countDigit(grid: Grid, digit: number) {
  return grid.reduce((sum, value) => sum + (value === digit ? 1 : 0), 0);
}

function IconNotes() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 9h3M13 9h3M8 12h3M13 12h3M8 15h3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function IconErase() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 15l6-8 8 6-5 7H8z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 20h16" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function IconHint() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4a5 5 0 0 1 2 9.6V16H10v-2.4A5 5 0 0 1 12 4z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 19h4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8.5 12.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function IconPause() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6v12M16 6v12" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function IconPlay() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6l11 6-11 6z" fill="currentColor" />
    </svg>
  );
}
function IconAgain() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 8H4V5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 8a7 7 0 1 1-1 4" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

type InstallPrompt = Event & { prompt: () => Promise<void> };

export function SudokuDesk() {
  const week = weekSeed();
  const [state, setState] = useState<DeskState | null>(null);
  const [playing, setPlaying] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [board, setBoard] = useState<WeeklyRow[]>([]);
  const [winOpen, setWinOpen] = useState(false);
  const [station, setStation] = useState<(typeof STATIONS)[number]["id"] | null>(null);
  const [radioOn, setRadioOn] = useState(false);
  const [radioError, setRadioError] = useState("");
  const [promptEvent, setPromptEvent] = useState<InstallPrompt | null>(null);
  const [installOpen, setInstallOpen] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const submitted = useRef(false);

  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const sync = () => {
      const ios = (navigator as Navigator & { standalone?: boolean }).standalone === true;
      setStandalone(media.matches || ios);
    };
    sync();
    media.addEventListener("change", sync);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);

  useEffect(() => {
    listWeekly()
      .then(setBoard)
      .catch(() => setBoard([]));
  }, [week]);

  useEffect(() => {
    if (!state?.running || state.done || !playing) return;
    const id = window.setInterval(() => {
      setState((current) => (current ? { ...current, elapsed: current.elapsed + 1 } : current));
    }, 1000);
    return () => window.clearInterval(id);
  }, [state?.running, state?.done, playing]);

  useEffect(() => {
    setWinOpen(Boolean(state?.done && playing));
  }, [state?.done, playing]);

  useEffect(() => {
    if (!state?.done || state.mode !== "weekly" || submitted.current) return;
    submitted.current = true;
    submitWeekly({ data: { seconds: state.elapsed } })
      .then(setBoard)
      .catch(() => undefined);
  }, [state?.done, state?.mode, state?.elapsed]);

  useEffect(() => {
    if (!state) return;
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, week }));
  }, [state, week]);

  function begin(mode: Mode, level: LevelId) {
    setPreparing(true);
    submitted.current = false;
    window.setTimeout(() => {
      setState(fresh(mode, level, week));
      setPlaying(true);
      setPreparing(false);
    }, 30);
  }

  function place(value: number) {
    setState((current) => {
      if (!current || current.done || current.sel < 0 || current.given[current.sel]) return current;
      const grid = current.grid.slice();
      let notes = current.notes.map((entry) => entry.slice());
      const helped = current.helped.slice();
      if (current.notesMode) {
        if (grid[current.sel]) return current;
        const bag = new Set(notes[current.sel]);
        if (bag.has(value)) bag.delete(value);
        else bag.add(value);
        notes[current.sel] = [...bag].sort((a, b) => a - b);
        return { ...current, notes, status: "", message: "" };
      }
      grid[current.sel] = grid[current.sel] === value ? 0 : value;
      notes[current.sel] = [];
      helped[current.sel] = false;
      if (grid[current.sel]) notes = clearPeerNotes(notes, current.sel, value);
      const solved = grid.every((cell, index) => cell === current.solution[index]);
      if (solved) remember(current, current.elapsed);
      return {
        ...current,
        grid,
        notes,
        helped,
        done: solved,
        running: !solved,
        status: solved ? "win" : "",
        message: solved ? "اكتمل اللغز." : "",
      };
    });
  }

  function remember(current: DeskState, elapsed: number) {
    const key = current.mode === "weekly" ? `weekly-${week}` : current.level;
    const bests = readBests();
    if (bests[key] == null || elapsed < (bests[key] ?? Infinity)) {
      bests[key] = elapsed;
      localStorage.setItem(BEST_KEY, JSON.stringify(bests));
    }
  }

  function erase() {
    setState((current) => {
      if (!current || current.sel < 0 || current.given[current.sel] || current.done) return current;
      const grid = current.grid.slice();
      const notes = current.notes.map((entry) => entry.slice());
      const helped = current.helped.slice();
      grid[current.sel] = 0;
      notes[current.sel] = [];
      helped[current.sel] = false;
      return { ...current, grid, notes, helped, status: "", message: "" };
    });
  }

  function hint() {
    setState((current) => {
      if (!current || current.mode === "weekly" || current.done || current.hintsLeft <= 0) return current;
      const open: number[] = [];
      for (let i = 0; i < 81; i++) if (current.grid[i] !== current.solution[i]) open.push(i);
      if (!open.length) return current;
      const index =
        current.sel >= 0 && current.grid[current.sel] !== current.solution[current.sel]
          ? current.sel
          : open[Math.floor(Math.random() * open.length)]!;
      const grid = current.grid.slice();
      const given = current.given.slice();
      const helped = current.helped.slice();
      const notes = current.notes.map((entry) => entry.slice());
      grid[index] = current.solution[index] ?? 0;
      given[index] = true;
      helped[index] = true;
      notes[index] = [];
      const solved = grid.every((cell, i) => cell === current.solution[i]);
      if (solved) remember(current, current.elapsed);
      return {
        ...current,
        grid,
        given,
        helped,
        notes,
        sel: index,
        hintsLeft: current.hintsLeft - 1,
        done: solved,
        running: !solved,
        status: solved ? "win" : "",
        message: solved ? "اكتمل اللغز." : "",
      };
    });
  }

  function check() {
    setState((current) => {
      if (!current || current.done) return current;
      const wrong = current.grid.some(
        (value, index) => value !== 0 && !current.given[index] && value !== current.solution[index],
      );
      return {
        ...current,
        status: wrong ? "bad" : "ok",
        message: wrong ? "في أرقام لا تطابق الحل." : "ما كُتب حتى الآن صحيح.",
      };
    });
  }

  async function tune(id: (typeof STATIONS)[number]["id"]) {
    const next = STATIONS.find((item) => item.id === id);
    const audio = audioRef.current;
    if (!next || !audio) return;
    setRadioError("");
    setStation(id);
    if (audio.src !== next.url) {
      audio.src = next.url;
    }
    try {
      await audio.play();
      setRadioOn(true);
    } catch {
      setRadioOn(false);
      setRadioError("تعذر بث هذه القناة الآن.");
    }
  }

  function toggleRadio() {
    const audio = audioRef.current;
    if (!audio) return;
    if (radioOn) {
      audio.pause();
      setRadioOn(false);
      return;
    }
    void tune(station ?? "nagham");
  }

  const selectedValue = state && state.sel >= 0 ? state.grid[state.sel] : 0;
  const personalBest = state
    ? readBests()[state.mode === "weekly" ? `weekly-${week}` : state.level]
    : undefined;

  return (
    <main className="desk">
      <audio ref={audioRef} preload="none" onError={() => setRadioError("تعذر بث هذه القناة الآن.")} />
      <header className="mast">
        <div>
          <p className="kicker">سودوكو</p>
          <h1>{playing ? (state?.mode === "weekly" ? "لغز الأسبوع" : "لغز حر") : "اختر المستوى"}</h1>
        </div>
        <div className="who">
          {playing ? <div className="clock">{formatClock(state?.elapsed ?? 0)}</div> : null}
          <UserButton />
        </div>
      </header>

      {!playing ? (
        <section className="lobby">
          <div className="level-grid">
            {LEVELS.map((level) => (
              <button key={level.id} type="button" className="level-card" onClick={() => begin("free", level.id)}>
                <span>{level.label}</span>
              </button>
            ))}
          </div>
          <button type="button" className="weekly-card" onClick={() => begin("weekly", "expert")}>
            <strong>لغز الأسبوع</strong>
            <span>مستوى خبير. لغز واحد للجميع هذا الأسبوع، بلا مساعدة، حتى تُقارن الأوقات.</span>
          </button>
          <div className="board-list">
            <p className="kicker">مقارنة الأسبوع</p>
            {board.length ? (
              <ol>
                {board.map((row, index) => (
                  <li key={`${row.displayName}-${index}`} className={row.mine ? "mine" : ""}>
                    <span>{index + 1}. {row.displayName}</span>
                    <span className="tabular">{formatClock(row.seconds)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="note">لم يُنهَ لغز هذا الأسبوع بعد.</p>
            )}
          </div>
          {state && !state.done ? (
            <button type="button" className="install-btn" onClick={() => setPlaying(true)}>
              متابعة اللغز
            </button>
          ) : null}
        </section>
      ) : (
        <>
          <div className="play-meta">
            <button type="button" className="text-btn" onClick={() => setPlaying(false)}>
              المستويات
            </button>
            <span className="best">
              {personalBest != null ? `أفضل وقت ${formatClock(personalBest)}` : "لا وقت محفوظ"}
            </span>
          </div>
          <div className="board-wrap">
            <div className="board" role="grid" aria-label="شبكة سودوكو">
              {Array.from({ length: 81 }, (_, index) => {
                const value = state?.grid[index] ?? 0;
                const given = state?.given[index] ?? false;
                const helped = state?.helped[index] ?? false;
                const notes = state?.notes[index] ?? [];
                const selected = state?.sel === index;
                const peer = state ? peerOf(state.sel, index) : false;
                const same = !!selectedValue && value === selectedValue;
                const conflict = state ? hasConflict(state.grid, index) && !given : false;
                const row = Math.floor(index / 9);
                const col = index % 9;
                return (
                  <button
                    key={index}
                    type="button"
                    className={[
                      "cell",
                      given && value && !helped ? "given" : "",
                      helped ? "helped" : "",
                      selected ? "selected" : "",
                      !selected && peer ? "peer" : "",
                      !selected && same ? "same" : "",
                      conflict ? "conflict" : "",
                      col === 2 || col === 5 ? "thick-r" : "",
                      row === 2 || row === 5 ? "thick-b" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-label={helped ? `مساعدة ${value}` : undefined}
                    onClick={() => setState((current) => (current ? { ...current, sel: index } : current))}
                  >
                    {value ? (
                      value
                    ) : notes.length ? (
                      <span className="notes">
                        {Array.from({ length: 9 }, (_, n) => (
                          <span key={n}>{notes.includes(n + 1) ? n + 1 : ""}</span>
                        ))}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            {preparing ? <div className="veil">يُجهَّز اللغز</div> : null}
          </div>
          <div className="digits">
            {Array.from({ length: 9 }, (_, n) => {
              const digit = n + 1;
              const spent = state ? countDigit(state.grid, digit) >= 9 : false;
              return (
                <button
                  key={digit}
                  type="button"
                  className={spent ? "digit spent" : "digit"}
                  onClick={() => place(digit)}
                  aria-label={spent ? `${digit} اكتمل` : String(digit)}
                >
                  {digit}
                </button>
              );
            })}
          </div>
          <div className={state?.mode === "weekly" ? "tools three" : "tools"}>
            <button
              type="button"
              className={state?.notesMode ? "tool on" : "tool"}
              onClick={() => setState((current) => (current ? { ...current, notesMode: !current.notesMode } : current))}
            >
              <IconNotes />
              ملاحظات
            </button>
            <button type="button" className="tool" onClick={erase}>
              <IconErase />
              مسح
            </button>
            {state?.mode !== "weekly" ? (
              <button type="button" className="tool" onClick={hint} disabled={!state || state.hintsLeft <= 0}>
                <IconHint />
                مساعدة {state?.hintsLeft ?? 0}
              </button>
            ) : null}
            <button type="button" className="tool" onClick={check}>
              <IconCheck />
              تحقق
            </button>
          </div>
          <div className="tools pair">
            <button
              type="button"
              className="tool"
              onClick={() =>
                setState((current) =>
                  current && !current.done ? { ...current, running: !current.running } : current,
                )
              }
            >
              {state?.running ? <IconPause /> : <IconPlay />}
              {state?.running ? "إيقاف" : "متابعة"}
            </button>
            <button
              type="button"
              className="tool primary"
              onClick={() => begin(state?.mode ?? "free", state?.level ?? "mid")}
            >
              <IconAgain />
              {state?.mode === "weekly" ? "إعادة المحاولة" : "لغز جديد"}
            </button>
          </div>
          <p className={state?.status === "bad" ? "note bad" : state?.status === "ok" ? "note ok" : "note"}>
            {state?.message || (state?.mode === "weekly" ? "لغز الأسبوع بلا مساعدة." : "")}
          </p>
          {!standalone ? (
            <section className="install">
              <button
                type="button"
                className="install-btn"
                onClick={() => {
                  if (promptEvent) {
                    void promptEvent.prompt();
                    setPromptEvent(null);
                    return;
                  }
                  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
                    window.location.assign("/?install=1&platform=ios");
                    return;
                  }
                  setInstallOpen(true);
                }}
              >
                تثبيت التطبيق على الجوال
              </button>
              {installOpen && !promptEvent ? (
                <p>من كروم: النقاط الثلاث، ثم تثبيت التطبيق. ليس من داخل واتساب.</p>
              ) : null}
            </section>
          ) : null}
        </>
      )}

      <section className="radio" aria-label="راديو">
        <div className="radio-head">
          <button type="button" className="radio-play" onClick={toggleRadio} aria-label={radioOn ? "إيقاف الراديو" : "تشغيل الراديو"}>
            {radioOn ? <IconPause /> : <IconPlay />}
          </button>
          <div>
            <p className="kicker">راديو</p>
            <strong>{STATIONS.find((item) => item.id === station)?.name ?? "أغانٍ عربية"}</strong>
          </div>
        </div>
        <div className="stations">
          {STATIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={station === item.id && radioOn ? "station on" : "station"}
              onClick={() => void tune(item.id)}
            >
              {item.name}
            </button>
          ))}
        </div>
        {radioError ? <p className="note bad">{radioError}</p> : null}
      </section>

      {state?.done && winOpen ? (
        <div className="win" role="dialog" aria-modal="true">
          <div className="win-card">
            <h2>تم الحل</h2>
            <p>{state.mode === "weekly" ? "وقتك دخل مقارنة الأسبوع إن كان الأفضل." : "لغز نظيف."}</p>
            <div className="clock">{formatClock(state.elapsed)}</div>
            <div className="win-actions">
              <button type="button" onClick={() => setWinOpen(false)}>
                إغلاق
              </button>
              <button type="button" className="solid" onClick={() => setPlaying(false)}>
                المستويات
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
