"use strict";
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const inline = (s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");

let P = null;            // the loaded challenge (challenges/<name>.json)
let challengeName = "";
let editor = null;       // CodeMirror instance (or null → textarea fallback)
let results = null;      // last run: { mode, cases, outcomes, verdict, ... }
let selCase = 0;         // selected case in Testcase tab
let selResult = 0;       // selected case in Test Result tab
let activeTab = "cases";
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
};

/* ---------- problem ---------- */
// ?challenge=<file name without .json> shows that challenge; without it a wheel picks one at random
const queryName = new URLSearchParams(location.search).get("challenge");
let challengeReady = null;   // resolves when the challenge is loaded and shown

async function listChallenges() {
  const res = await fetch("challenges/index.json");
  if (!res.ok) throw new Error("challenges/index.json: HTTP " + res.status);
  return res.json();
}
const prettyName = (slug) => slug.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

async function loadProblem(name) {
  if (!/^[A-Za-z0-9_-]+$/.test(name || "")) throw new Error("invalid challenge name");
  challengeName = name;
  const res = await fetch("challenges/" + name + ".json");
  if (!res.ok) throw new Error("challenges/" + name + ".json: HTTP " + res.status);
  P = await res.json();
  document.title = P.title + " – Coding Interview Sandbox";
  renderDescription();
  initEditor();
  renderBottom();
}
function showLoadError(e) {
  $("desc").innerHTML = `<p class="err">Could not load the challenge: ${esc(e.message)}</p>` +
    `<p class="hint">Opening index.html straight from disk is blocked by the browser. Serve the folder instead, e.g. <code>python -m http.server</code>, or use the github.io URL.</p>`;
}

function renderDescription() {
  let h = `<h1 style="margin-bottom:16px">${esc(P.title)}</h1>`;
  h += P.description.map((p) => `<p>${inline(p)}</p>`).join("");
  P.examples.forEach((e, i) => {
    h += `<h3>Example ${i + 1}:</h3><pre>Input: ${esc(e.input)}\nOutput: ${esc(e.output)}` +
         (e.explanation ? `\nExplanation: ${esc(e.explanation)}` : "") + `</pre>`;
  });
  h += `<h3>Constraints:</h3><ul>${P.constraints.map((c) => `<li>${inline(c)}</li>`).join("")}</ul>`;
  if (P.followUp) h += `<p style="margin-top:16px"><b>Follow up:</b> ${inline(P.followUp)}</p>`;
  $("desc").innerHTML = h;
}

/* ---------- editor ---------- */
function initEditor() {
  const saved = store.get("code:" + challengeName);
  const start = saved !== null ? saved : P.starterCode;
  const host = $("editorHost");
  if (window.CodeMirror) {
    editor = CodeMirror(host, {
      value: start, mode: "python", theme: "material-darker", lineNumbers: true,
      indentUnit: 4, matchBrackets: true,
      extraKeys: {
        Tab: (cm) => cm.somethingSelected() ? cm.indentSelection("add") : cm.replaceSelection("    ", "end"),
        "Shift-Tab": (cm) => cm.indentSelection("subtract"),
        "Ctrl-Enter": () => run("run"),
        "Cmd-Enter": () => run("run"),
      },
    });
    editor.on("change", () => store.set("code:" + challengeName, editor.getValue()));
    lockClipboard(editor.getWrapperElement());
  } else {
    host.innerHTML = '<textarea id="fallback" spellcheck="false"></textarea>';
    const ta = $("fallback"); ta.value = start;
    ta.addEventListener("input", () => store.set("code:" + challengeName, ta.value));
    lockClipboard(ta);
  }
}
/* ---------- the code window blocks copy, cut and paste ---------- */
function lockClipboard(el) {
  const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
  ["copy", "cut", "paste", "drop", "dragstart", "contextmenu"].forEach((t) => el.addEventListener(t, stop, true));
  el.addEventListener("keydown", (e) => {
    const k = (e.key || "").toLowerCase();
    const mod = e.ctrlKey || e.metaKey;
    // Ctrl/Cmd + C, X, V, and the old Ctrl+Insert, Shift+Insert, Shift+Delete
    if ((mod && (k === "c" || k === "x" || k === "v" || k === "insert")) ||
        (e.shiftKey && (k === "insert" || k === "delete"))) stop(e);
  }, true);
}

const getCode = () => editor ? editor.getValue() : $("fallback").value;
const setCode = (v) => { if (editor) editor.setValue(v); else $("fallback").value = v; };
// Reset asks for a second click on the button itself. A browser confirm() box would
// make the browser leave full-screen mode.
let resetTimer = null;
$("resetBtn").onclick = () => {
  const btn = $("resetBtn");
  if (resetTimer) {
    clearTimeout(resetTimer); resetTimer = null;
    btn.textContent = "Reset";
    setCode(P.starterCode);
    return;
  }
  btn.textContent = "Click again to reset";
  resetTimer = setTimeout(() => { resetTimer = null; btn.textContent = "Reset"; }, 3000);
};

/* ---------- python worker ---------- */
let worker = null, readyPromise = null, onMsg = null;
const harnessText = fetch("assets/python/harness.py").then((r) => { if (!r.ok) throw new Error("harness.py: HTTP " + r.status); return r.text(); });
function startWorker() {
  if (worker) worker.terminate();
  $("pyStatus").textContent = "Loading Python…";
  worker = new Worker("assets/js/pyodide-worker.js");
  const w = worker;
  readyPromise = new Promise((resolve, reject) => {
    w.onmessage = (ev) => {
      if (ev.data.type === "ready") { $("pyStatus").textContent = "Python 3 ready"; resolve(); }
      else if (ev.data.type === "fatal") { $("pyStatus").textContent = "Python failed to load"; reject(new Error(ev.data.message)); }
      else if (onMsg) onMsg(ev.data);
    };
    w.onerror = (e) => { $("pyStatus").textContent = "Python failed to load"; reject(new Error(e.message || "worker error")); };
    harnessText.then((harness) => w.postMessage({ type: "init", harness }), reject);
  });
  readyPromise.catch(() => {});
}

/* Runs `cases` (arrays of args). Resolves { compileError?, outcomes[], tle? } */
async function execute(cases) {
  await readyPromise;
  const w = worker, limit = P.timeLimitMs || 5000;
  return new Promise((resolve) => {
    const outcomes = [];
    let timer = null;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        onMsg = null;
        startWorker();               // kill the stuck run, get a fresh interpreter
        resolve({ outcomes, tle: outcomes.length });
      }, limit);
    };
    onMsg = (m) => {
      if (m.type === "case") { outcomes[m.i] = { ...m.r, ms: m.ms }; arm(); }
      else if (m.type === "done") { clearTimeout(timer); onMsg = null; resolve({ outcomes }); }
      else if (m.type === "compile_error") { clearTimeout(timer); onMsg = null; resolve({ compileError: m.message, outcomes }); }
      else if (m.type === "fatal") { clearTimeout(timer); onMsg = null; resolve({ compileError: m.message, outcomes }); }
    };
    arm();
    w.postMessage({ type: "run", code: getCode(), fn: P.function, cases });
  });
}

/* ---------- run / submit ---------- */
// "compare": "unordered" in a challenge file accepts the list in any order
const sameValue = (a, b) => {
  if (P.compare === "unordered" && Array.isArray(a) && Array.isArray(b)) {
    const key = (x) => JSON.stringify(x);
    return key([...a].map(key).sort()) === key([...b].map(key).sort());
  }
  return JSON.stringify(a) === JSON.stringify(b);
};

async function run(mode) {
  if (!P) return;
  const cases = P.testcases.filter((t) => mode === "submit" || !t.hidden);
  setBusy(true);
  showTab("result");
  $("bottom").innerHTML = '<p class="hint">Running…</p>';
  let r;
  try { r = await execute(cases.map((c) => c.args)); }
  catch (e) { r = { compileError: "Could not start Python: " + e.message, outcomes: [] }; startWorker(); }

  const out = { mode, cases, outcomes: [], status: "Accepted", failIdx: -1, ms: 0 };
  if (r.compileError) { out.status = "Compile Error"; out.message = r.compileError; }
  else {
    cases.forEach((c, i) => {
      const o = r.outcomes[i];
      if (!o) { out.outcomes[i] = { state: i === r.tle ? "tle" : "skipped" }; return; }
      out.ms += o.ms;
      if (!o.ok) out.outcomes[i] = { state: "error", error: o.error, stdout: o.stdout };
      else out.outcomes[i] = { state: sameValue(o.result, c.expected) ? "pass" : "wrong", result: o.result, stdout: o.stdout };
    });
    const bad = out.outcomes.findIndex((o) => o.state !== "pass" && o.state !== "skipped");
    if (bad >= 0) {
      out.failIdx = bad;
      out.status = { wrong: "Wrong Answer", error: "Runtime Error", tle: "Time Limit Exceeded" }[out.outcomes[bad].state];
    }
  }
  results = out;
  selResult = out.failIdx >= 0 ? out.failIdx : 0;
  setBusy(false);
  renderBottom();
}
function setBusy(b) { $("runBtn").disabled = b; $("submitBtn").disabled = b; }
$("runBtn").onclick = () => run("run");
$("submitBtn").onclick = () => run("submit");

/* ---------- bottom panel ---------- */
function showTab(t) {
  activeTab = t;
  document.querySelectorAll("#resultPane .tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === t));
  renderBottom();
}
document.querySelectorAll("#resultPane .tab").forEach((b) => b.onclick = () => showTab(b.dataset.tab));

function fmtArg(v) {
  const s = JSON.stringify(v);
  return s.length > 600 ? s.slice(0, 600) + " … (" + s.length + " chars)" : s;
}
function fmtInput(args) { return P.params.map((n, i) => `${n} =\n${fmtArg(args[i])}`).join("\n"); }
function inputBlocks(args) {
  return P.params.map((n, i) => `<div class="label">${esc(n)} =</div><div class="box">${esc(fmtArg(args[i]))}</div>`).join("");
}

function renderBottom() {
  if (!P) return;
  const el = $("bottom");
  if (activeTab === "cases") {
    const vis = P.testcases.filter((t) => !t.hidden);
    selCase = Math.min(selCase, vis.length - 1);
    el.innerHTML =
      `<div class="casebar">${vis.map((_, i) => `<button class="chip ${i === selCase ? "active" : ""}" data-i="${i}">Case ${i + 1}</button>`).join("")}</div>` +
      inputBlocks(vis[selCase].args) +
      `<p class="hint" style="margin-top:14px">Run tests these cases. Submit also runs hidden cases.</p>`;
    el.querySelectorAll(".chip").forEach((c) => c.onclick = () => { selCase = +c.dataset.i; renderBottom(); });
    return;
  }
  if (!results) { el.innerHTML = '<p class="hint">You must run your code first.</p>'; return; }
  const r = results, total = r.cases.length;
  const passed = r.outcomes.filter((o) => o.state === "pass").length;
  const ok = r.status === "Accepted";
  let h = `<div class="verdict ${ok ? "ok" : "bad"}">${r.status}</div>`;
  if (r.status === "Compile Error") {
    el.innerHTML = h + `<div class="box err">${esc(r.message)}</div>`;
    return;
  }
  h += `<div class="sub">${r.mode === "submit" ? `${passed} / ${total} testcases passed` : `${passed} / ${total} sample cases passed`}` +
       (ok ? ` · Runtime: ${Math.round(r.ms)} ms` : "") + `</div>`;
  if (r.mode === "run") {
    h += `<div class="casebar">${r.outcomes.map((o, i) =>
      `<button class="chip ${i === selResult ? "active" : ""}" data-i="${i}"><span class="dot ${o.state === "pass" ? "pass" : "fail"}"></span>Case ${i + 1}</button>`).join("")}</div>`;
  }
  const i = r.mode === "run" ? selResult : r.failIdx;
  if (i >= 0) {
    const o = r.outcomes[i], c = r.cases[i];
    if (r.mode === "submit") h += `<div class="sub">Failed on testcase ${i + 1}${c.hidden ? " (hidden)" : ""}</div>`;
    h += inputBlocks(c.args);
    if (o.state === "tle") h += `<div class="label">Output</div><div class="box err">Time Limit Exceeded (over ${(P.timeLimitMs || 5000) / 1000} s)</div>`;
    else if (o.state === "skipped") h += `<div class="label">Output</div><div class="box hint">Not run</div>`;
    else if (o.state === "error") h += `<div class="label">Error</div><div class="box err">${esc(o.error)}</div>`;
    else h += `<div class="label">Output</div><div class="box ${o.state === "pass" ? "" : "err"}">${esc(fmtArg(o.result))}</div>`;
    h += `<div class="label">Expected</div><div class="box">${esc(fmtArg(c.expected))}</div>`;
    if (o.stdout) h += `<div class="label">Stdout</div><div class="box">${esc(o.stdout)}</div>`;
  }
  el.innerHTML = h;
  el.querySelectorAll(".chip").forEach((c) => c.onclick = () => { selResult = +c.dataset.i; renderBottom(); });
}

/* ---------- resizable panes ---------- */
function drag(handle, onMove) {
  handle.addEventListener("pointerdown", (e) => {
    e.preventDefault(); handle.setPointerCapture(e.pointerId); handle.classList.add("drag");
    const move = (ev) => onMove(ev);
    const up = () => { handle.classList.remove("drag"); handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", up); if (editor) editor.refresh(); };
    handle.addEventListener("pointermove", move); handle.addEventListener("pointerup", up);
  });
}
drag($("gv"), (e) => {
  const r = $("main").getBoundingClientRect();
  $("left").style.width = Math.max(240, Math.min(r.width - 340, e.clientX - r.left - 8)) + "px";
});
drag($("gh"), (e) => {
  const r = $("right").getBoundingClientRect();
  $("editorPane").style.height = Math.max(120, Math.min(r.height - 120, e.clientY - r.top)) + "px";
});

/* ---------- the problem text cannot be selected, copied or dragged ---------- */
["copy", "cut", "contextmenu", "dragstart", "selectstart"].forEach((t) =>
  $("left").addEventListener(t, (e) => e.preventDefault()));

/* ---------- leaving the window: counted and shown next to the Python status ---------- */
// The page cannot see another screen, but it knows when this window stops being the active one
// (a click on another window or screen, another tab, minimizing). Each time is counted and kept.
function startFocusWatch(start) {
  const key = "away:" + challengeName;
  let log = [];
  try { log = JSON.parse(store.get(key) || "[]").filter((e) => e.at >= start); } catch (e) {}
  const note = $("awayNote");
  let leftAt = 0;
  const fmt = (s) => s < 60 ? s + " s" : Math.floor(s / 60) + " min " + String(s % 60).padStart(2, "0") + " s";
  const show = () => {
    if (!log.length) return;
    const total = log.reduce((a, e) => a + e.seconds, 0);
    note.textContent = "Left window: " + log.length + (log.length === 1 ? " time, " : " times, ") + fmt(total) + " away in total";
    note.title = log.slice(-10).map((e) => new Date(e.at).toLocaleTimeString() + " (" + e.seconds + " s)").join("\n");
    note.hidden = false;
  };
  const leave = () => { if (!leftAt) leftAt = Date.now(); };
  const back = () => {
    if (!leftAt) return;
    const seconds = Math.max(1, Math.round((Date.now() - leftAt) / 1000));
    log.push({ at: leftAt, seconds });
    leftAt = 0;
    store.set(key, JSON.stringify(log));
    show();
  };
  window.addEventListener("blur", leave);
  window.addEventListener("focus", back);
  document.addEventListener("visibilitychange", () => (document.hidden ? leave() : back()));
  show();
}

/* ---------- timer: counts up from when the page opens; survives a reload ---------- */
function startTimer() {
  const key = "start:" + challengeName;
  let start = Number(store.get(key));
  // no saved start, or one older than 12 hours (an earlier session): begin now
  if (!start || Date.now() - start > 12 * 3600 * 1000 || start > Date.now()) {
    start = Date.now();
    store.set(key, String(start));
  }
  const el = $("timer"), pad = (n) => String(n).padStart(2, "0");
  const tick = () => {
    const s = Math.floor((Date.now() - start) / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    el.textContent = (h ? h + ":" + pad(m) : pad(m)) + ":" + pad(s % 60);
  };
  tick();
  setInterval(tick, 1000);
  startFocusWatch(start);
}

/* ---------- rules gate: confirm, full screen, [wheel], count 3-2-1, then show the page ---------- */
// Safari older than 16.4 only has the webkit-prefixed API, and iPhone Safari has none
function enterFullscreen() {
  const el = document.documentElement;
  if (document.fullscreenElement || document.webkitFullscreenElement) return;
  const fn = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!fn) return;
  try {
    const p = fn.call(el);
    if (p && p.catch) p.catch(() => {});
  } catch (e) {}
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pickWithWheel() {
  const names = await listChallenges();
  const buf = new Uint32Array(1); crypto.getRandomValues(buf);
  const target = buf[0] % names.length;
  $("wheelBox").hidden = false;
  await spinWheel($("wheel"), names.map(prettyName), target, 4200);
  $("wheelResult").textContent = prettyName(names[target]);
  await sleep(1300);
  $("wheelBox").hidden = true;
  // keep the pick on reload, so reloading does not re-roll the question
  try { history.replaceState(null, "", "?challenge=" + encodeURIComponent(names[target])); } catch (e) {}
  challengeReady = loadProblem(names[target]);
}

$("confirmBtn").onclick = async () => {
  $("confirmBtn").disabled = true;
  // the click is the user gesture browsers require for full screen
  enterFullscreen();
  $("rules").hidden = true;
  try { if (!queryName) await pickWithWheel(); } catch (e) { challengeReady = Promise.reject(e); }
  const cd = $("countdown");
  cd.hidden = false;
  for (let n = 3; n >= 1; n--) { cd.textContent = n; await sleep(1000); }
  try { await challengeReady; } catch (e) { showLoadError(e); }
  $("gate").remove();
  if (P) startTimer();
  if (editor) { editor.refresh(); editor.focus(); }
};

/* ---------- start ---------- */
startWorker();
if (queryName) { challengeReady = loadProblem(queryName); challengeReady.catch(() => {}); }
else listChallenges().catch(() => {});   // warm the cache for the wheel
