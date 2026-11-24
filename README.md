<div align="center">

<img src="assets/img/icon-192.png" alt="Coding Interview Sandbox logo" width="96" height="96">

# Coding Interview Sandbox

**A LeetCode-style Python coding assessment that runs entirely in the browser.**
No server, no database, no API keys. Host it on GitHub Pages.

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
![Static site](https://img.shields.io/badge/site-static-blue)
![Python 3](https://img.shields.io/badge/python-3%20(Pyodide)-yellow)

[Live demo](https://ainlamyae.github.io/coding-interview-sandbox/) · [Add a challenge](#adding-a-challenge) · [Deploy](#deployment)

</div>

---

## Table of contents

- [Overview](#overview)
- [Features](#features)
- [Quick start](#quick-start)
- [How it works](#how-it-works)
- [Using it in an interview](#using-it-in-an-interview)
- [Challenge bank](#challenge-bank)
- [Adding a challenge](#adding-a-challenge)
- [Challenge file reference](#challenge-file-reference)
- [Project structure](#project-structure)
- [Deployment](#deployment)
- [Security and limitations](#security-and-limitations)
- [Browser support](#browser-support)
- [Contributing](#contributing)
- [Acknowledgements](#acknowledgements)
- [License](#license)

## Overview

Coding Interview Sandbox gives a candidate a familiar problem-solving screen: the problem statement on the left, a Python editor on the top right, and the test cases and results on the bottom right. The candidate writes a solution, runs it against the sample cases, and submits it against a larger set of hidden cases.

Everything is static files. Python runs in the candidate's browser through [Pyodide](https://pyodide.org) (CPython compiled to WebAssembly), so the project can be hosted for free and needs no backend.

## Features

- **Familiar layout:** problem, editor and results in three resizable panes (40% description and 60% code by default).
- **Real Python 3:** the candidate's code runs in a Web Worker, so an endless loop is stopped and reported as Time Limit Exceeded.
- **Run and Submit:** Run tests the sample cases. Submit also runs the hidden cases.
- **Clear verdicts:** Accepted, Wrong Answer, Runtime Error, Time Limit Exceeded and Compile Error, with input, output, expected value and stdout.
- **Assessment gate:** a rules page the candidate must accept, then full-screen mode and a 3-2-1 countdown.
- **Challenge wheel:** opening the site without a challenge name spins a wheel that picks one at random.
- **Fixed challenge links:** `?challenge=<name>` opens one specific challenge, with no wheel.
- **Challenge bank:** each challenge is one JSON file, with no code change needed to add one.
- **Protected statement:** the problem text cannot be selected, copied or dragged.
- **Search-ready:** meta tags, Open Graph and Twitter cards, JSON-LD, `robots.txt`, `sitemap.xml`, favicon set and a web manifest.

## Quick start

**Prerequisite:** any static file server. Python 3 is enough.

```bash
git clone https://github.com/ainlamyae/coding-interview-sandbox.git
cd coding-interview-sandbox
python -m http.server 8000
```

Open <http://localhost:8000>.

> Opening `index.html` by double-clicking it does not work. Browsers block `fetch` on `file://`, so the challenge files cannot load. Always serve the folder.

## How it works

```
 Browser
 ├── index.html ── assets/js/app.js        page logic, panes, results
 │                 assets/js/wheel.js      challenge wheel
 │                 fetch ─► challenges/*.json   problem, starter code, tests
 │
 └── Web Worker ── assets/js/pyodide-worker.js
                   └── Pyodide (from CDN) + assets/python/harness.py
                       runs the candidate's code once per test case
```

1. The page loads a challenge JSON file.
2. On Run or Submit, the editor code and the test arguments are sent to a Web Worker.
3. `harness.py` executes the code, calls `Solution.<function>(*args)` for each case, and captures the return value and stdout.
4. The page compares each result with the expected value and shows the verdict.
5. If a test takes longer than `timeLimitMs`, the worker is stopped and replaced with a fresh one.

Candidates write a `class Solution` with the method named in the challenge, the same as on LeetCode. A plain top-level function with the same name also works.

## Using it in an interview

1. Send the candidate a link.
   - `https://ainlamyae.github.io/coding-interview-sandbox/` spins the wheel and picks a challenge.
   - `https://ainlamyae.github.io/coding-interview-sandbox/?challenge=task-scheduler` opens that challenge.
2. The candidate accepts the assessment guidelines. The page goes full screen and counts down 3-2-1.
3. The candidate writes the solution, uses Run on the samples, and Submit for the full test set.
4. The result panel shows the verdict and the number of passed tests. The editor keeps the code in the browser, so a refresh does not lose it.

When the wheel picks a challenge, the address changes to `?challenge=<name>`, so reloading the page keeps the same question.

## Challenge bank

| Challenge | File |
| --- | --- |
| Number of Islands | `challenges/number-of-islands.json` |
| Course Schedule | `challenges/course-schedule.json` |
| Graph Valid Tree | `challenges/graph-valid-tree.json` |
| Meeting Rooms | `challenges/meeting-rooms.json` |
| Top K Frequent Elements | `challenges/top-k-frequent-elements.json` |
| Task Scheduler | `challenges/task-scheduler.json` |

Each challenge has a few sample cases and a larger set of hidden edge cases, including maximum-size inputs. The expected answers were computed with reference solutions.

## Adding a challenge

1. Copy an existing file in `challenges/`, for example `meeting-rooms.json`, to `challenges/<new-name>.json`. Use letters, digits, `-` and `_` in the name.
2. Edit the fields described below.
3. Add `"<new-name>"` to `challenges/index.json`. The wheel uses this list.
4. Open `http://localhost:8000/?challenge=<new-name>` and check it with a correct solution and a wrong one.

## Challenge file reference

```jsonc
{
  "id": 252,
  "title": "Meeting Rooms",
  "difficulty": "Easy",                 // kept in the file, not shown on the page
  "description": ["Paragraph with `code` and **bold**."],
  "examples": [
    { "input": "intervals = [[7,10],[2,4]]", "output": "true", "explanation": "optional" }
  ],
  "constraints": ["`0 <= intervals.length <= 10^4`"],
  "followUp": "Optional note shown under the constraints.",
  "compare": "unordered",              // optional: accept a list answer in any order
  "function": "canAttendMeetings",      // method the candidate implements
  "params": ["intervals"],              // parameter names, used to label inputs
  "starterCode": "class Solution:\n    def canAttendMeetings(self, intervals):\n        pass\n",
  "timeLimitMs": 5000,                  // limit per test case
  "testcases": [
    { "args": [[[7,10],[2,4]]], "expected": true, "hidden": false },
    { "args": [[]],             "expected": true, "hidden": true }
  ]
}
```

| Field | Required | Meaning |
| --- | --- | --- |
| `title` | yes | Heading shown on the left |
| `description`, `examples`, `constraints` | yes | Statement text. Backticks and `**bold**` are supported |
| `function`, `params` | yes | Function name and parameter names |
| `starterCode` | yes | Initial editor content |
| `testcases` | yes | `args` is the list of arguments, `expected` is the return value, `hidden` marks cases that run only on Submit |
| `timeLimitMs` | no | Limit per test case. Default 5000 |
| `followUp` | no | Extra note under the constraints |
| `compare` | no | `"unordered"` compares list answers without regard to order |
| `id`, `difficulty` | no | Kept for reference, not shown |

Values are compared as JSON, so `expected` must be JSON-serializable, and the function must return a JSON-serializable value.

## Project structure

```
.
├── index.html                  application page
├── 404.html                    not-found page
├── favicon.ico                 favicon
├── site.webmanifest            web app manifest
├── robots.txt                  crawler rules
├── sitemap.xml                 sitemap
├── LICENSE                     MIT license
├── README.md
├── .editorconfig
├── .gitignore
├── .nojekyll                   serve files as they are on GitHub Pages
├── assets/
│   ├── css/styles.css          styles
│   ├── js/
│   │   ├── app.js              page logic
│   │   ├── wheel.js            challenge wheel
│   │   └── pyodide-worker.js   Python worker
│   ├── python/harness.py       test harness run inside Pyodide
│   └── img/                    icons and social preview image
└── challenges/
    ├── index.json              list of challenge names
    └── <name>.json             one file per challenge
```

## Deployment

The site is plain static files, so any static host works. For GitHub Pages:

1. Push the repository to GitHub.
2. Open **Settings → Pages** and choose **Deploy from a branch**, branch `main`, folder `/ (root)`.
3. The site address is `https://ainlamyae.github.io/coding-interview-sandbox/`. If you fork the project, or use a custom domain or another repository name, replace that address in:
   - `index.html` (canonical link, Open Graph, Twitter and JSON-LD tags)
   - `robots.txt`
   - `sitemap.xml`
   - this README
4. Submit `https://ainlamyae.github.io/coding-interview-sandbox/sitemap.xml` in Google Search Console and Bing Webmaster Tools.

## Security and limitations

- **Tests are not secret.** The tests are static files that the browser downloads, so anyone with dev tools can read them. "Hidden" only means not shown in the page. Keeping tests truly secret needs a backend that runs the code and returns only the verdict.
- **Honor system.** The rules page, full-screen mode and the copy block on the statement deter casual cheating. They cannot detect other tools, a second device or leaving full screen.
- **Public site.** Search engines can index the page and the challenge files. Do not put anything confidential in `challenges/`.
- **Sandbox.** Candidate code runs inside WebAssembly in a Web Worker, in the candidate's own browser. It has no access to your files or network through Python.
- **Performance.** Pyodide is about 10 MB on the first load, then cached. Python code runs slower than native Python.
- **Recursion.** Python's default recursion limit applies, so very deep recursive solutions fail with a runtime error.

## Browser support

A current version of Chrome, Edge, Firefox or Safari with JavaScript and WebAssembly enabled. Full-screen mode needs a browser that supports the Fullscreen API.

## Contributing

Contributions are welcome, especially new challenges.

1. Fork the repository and create a branch.
2. Add or change files, following [`.editorconfig`](.editorconfig).
3. For a new challenge, verify the expected answers with an independent reference solution, keep inputs within the stated constraints, and include edge cases and maximum-size inputs.
4. Run the site locally and check the change with a correct solution and a wrong one.
5. Open a pull request that describes the change and why.

## Acknowledgements

- [Pyodide](https://pyodide.org) runs Python in the browser.
- [CodeMirror 5](https://codemirror.net) powers the editor.
- Problem statements are written for practice and are not affiliated with LeetCode.

## License

Released under the [MIT License](LICENSE).
