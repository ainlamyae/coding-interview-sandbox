/* Runs Python (Pyodide) off the main thread so an endless loop can be stopped. */
const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";
importScripts(PYODIDE + "pyodide.js");
let py = null;
onmessage = async (ev) => {
  const m = ev.data;
  try {
    if (m.type === "init") {
      py = await loadPyodide({ indexURL: PYODIDE });
      py.runPython(m.harness);
      postMessage({ type: "ready" });
    } else if (m.type === "run") {
      try {
        py.globals.get("load_user")(m.code);
      } catch (e) {
        const lines = String(e.message).split("\n").filter(l => !l.includes("harness") && !l.includes("<exec>"));
        postMessage({ type: "compile_error", message: lines.slice(-10).join("\n") });
        return;
      }
      const run = py.globals.get("run_case");
      for (let i = 0; i < m.cases.length; i++) {
        const t0 = performance.now();
        const r = JSON.parse(run(m.fn, JSON.stringify(m.cases[i])));
        postMessage({ type: "case", i, r, ms: performance.now() - t0 });
      }
      postMessage({ type: "done" });
    }
  } catch (e) {
    postMessage({ type: "fatal", message: String(e && e.message || e) });
  }
};
