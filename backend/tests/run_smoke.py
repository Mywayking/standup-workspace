#!/usr/bin/env python3
"""Standup 全面回归测试 - TokenHub
用法: python tests/run_smoke.py
"""
import subprocess, json, time

BACKEND = "http://localhost:8000"
PASS, FAIL = 0, 0

def curl(path, body, timeout=90):
    cmd = ["curl", "-s", "--max-time", str(timeout), "-X", "POST" if body else "GET",
           f"{BACKEND}{path}",
           "-H", "Content-Type: application/json"]
    if body:
        cmd += ["-d", json.dumps(body)]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout + 5)
    try:
        return json.loads(r.stdout)
    except:
        return {"_raw": r.stdout[:200]}

def check(cond, msg):
    global PASS, FAIL
    tag = "✅" if cond else "❌"
    print(f"  {tag} {msg}")
    if cond: PASS += 1
    else: FAIL += 1
    return cond

def section(name):
    print(f"\n  ── {name}")

def test(name, path, body, fn, timeout=120):
    print(f"  {name}...", end=" ", flush=True)
    t0 = time.time()
    d = curl(path, body, timeout)
    elapsed = time.time() - t0
    ok = fn(d)
    tag = "✅" if ok else "❌"
    print(f"{tag} ({elapsed:.0f}s)")
    if not ok:
        print(f"     响应: {str(d)[:300]}")
    global PASS, FAIL
    if ok: PASS += 1
    else: FAIL += 1
    time.sleep(0.5)
    return ok

# ── Health ──────────────────────────────────────────────────────────────────

section("Health")
test("health", "/health", None, lambda d: check(d.get("status")=="ok", "status=ok"))
test("openapi", "/openapi.json", None, lambda d: check("openapi" in d, "openapi schema OK"))

# ── joke-to-premise ───────────────────────────────────────────────────────────

section("joke-to-premise (曾有 premise 空字符串 bug)")

def j2p_ok(d):
    ok = check(d.get("input_type") == "joke_line", f"input_type=joke_line")
    if d.get("premises"):
        for i, p in enumerate(d["premises"][:3]):
            val = p.get("title", p.get("premise", ""))
            check(val.strip() != "", f"premises[{i}] title 非空 (got: {repr(val[:20])}...)")
    return ok

test("正常", "/api/write/joke-to-premise", {"text": "我老板每天加班到半夜，结果公司倒闭了"}, j2p_ok)
test("短文本", "/api/write/joke-to-premise", {"text": "我妈觉得我内向"}, lambda d: check(len(d.get("premises",[]))>=2, "至少2个前提"), timeout=120)

# ── premise-extract ───────────────────────────────────────────────────────────

section("premise-extract")
test("正常", "/api/write/premise-extract", {"text": "我妈觉得我很内向，其实我只是不想跟你说话"},
     lambda d: check(d.get("premise","").strip()!="", "premise 非空"))
test("长素材", "/api/write/premise-extract", {"text": "你知道为什么年轻人不愿意结婚了吗？因为结了婚之后生活质量下降了，单身的时候想吃就吃想睡就睡"},
     lambda d: check(d.get("error") is None, "无 error"))

# ── find-angle ────────────────────────────────────────────────────────────────

section("find-angle")
test("正常", "/api/write/find-angle", {"text": "我妈觉得我很内向"},
     lambda d: check(len(d.get("angles",[]))>=1, "至少1个角度"))
test("正常2", "/api/write/find-angle", {"text": "我老板每天加班到半夜，结果公司倒闭了"},
     lambda d: check(all(a.get("title","").strip() for a in d.get("angles",[])[:2]), "所有角度 title 非空"))

# ── rewrite ──────────────────────────────────────────────────────────────────

section("rewrite")
test("正常", "/api/write/rewrite", {"text": "我妈觉得我内向", "style": "更幽默"},
     lambda d: check(d.get("error") is None, "无 error"))

# ── analyze ───────────────────────────────────────────────────────────────────

section("analyze (非流式)")
test("正常", "/api/analyze", {"text": "我妈觉得我很内向，其实我只是不想跟你说话"},
     lambda d: check(d.get("comedy_type") not in (None,"?"), f"comedy_type={d.get('comedy_type')}"))
test("短文本拒绝", "/api/analyze", {"text": "短"}, lambda d: check("太短" in d.get("detail",""), "短文本被拒绝"))

# ── analyze/stream ─────────────────────────────────────────────────────────────

section("analyze/stream (SSE)")
def stream_check(key, min_len=1):
    def _check(d):
        return check(d.get(key) is not None and len(d.get(key,[]))>=min_len,
                     f"stream: {key} 有数据")
    return _check

test("正常流式", "/api/analyze/stream", {"text": "我妈觉得我很内向，其实我只是不想跟你说话"},
     stream_check("evaluation"), timeout=120)

# ── 汇总 ─────────────────────────────────────────────────────────────────────

print("\n" + "=" * 50)
ok = FAIL == 0
if ok:
    print(f"🎉 全部通过 ({PASS}/{PASS})")
else:
    print(f"⚠️  {FAIL} 项失败 ({PASS} 通过)")
print("=" * 50)