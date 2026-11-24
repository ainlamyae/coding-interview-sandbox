import json, io, contextlib, traceback

_ns = {}

def load_user(code):
    global _ns
    _ns = {"__name__": "__main__"}
    exec(compile(code, "solution.py", "exec"), _ns)

def run_case(fn, args_json):
    args = json.loads(args_json)
    out = io.StringIO()
    try:
        if "Solution" in _ns:
            target = getattr(_ns["Solution"](), fn)
        elif fn in _ns:
            target = _ns[fn]
        else:
            raise NameError("Define class Solution with method %s" % fn)
        with contextlib.redirect_stdout(out):
            res = target(*args)
        return json.dumps({"ok": True, "result": res, "stdout": out.getvalue()})
    except BaseException:
        tb = traceback.format_exc().splitlines()
        # drop harness frames, keep the user's
        keep = [l for l in tb if "harness" not in l and "<exec>" not in l]
        return json.dumps({"ok": False, "error": "\n".join(keep[-12:]), "stdout": out.getvalue()})
