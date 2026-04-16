#!/usr/bin/env python3
"""
脱口秀拉片分析系统 - 全功能测试用例
测试范围：projects / scripts / analysis / export
"""

import requests
import json
import time
import sys
from pathlib import Path

BASE = "http://localhost:8000"
HEADERS = {"Content-Type": "application/json"}

# ─── 颜色输出 ────────────────────────────────────────────────────────────────

def green(msg): print(f"\033[92m✅ {msg}\033[0m")
def red(msg):   print(f"\033[91m❌ {msg}\033[0m")
def yellow(msg): print(f"\033[93m⚠️  {msg}\033[0m")
def info(msg):  print(f"   {msg}")

# ─── 辅助 ────────────────────────────────────────────────────────────────────

def req(method, path, **kwargs):
    url = f"{BASE}{path}"
    r = requests.request(method, url, **kwargs)
    try:
        data = r.json()
    except:
        data = {"raw": r.text[:200]}
    return r.status_code, data

def test(name, status_expected, method, path, **kwargs):
    status, data = req(method, path, **kwargs)
    ok = status == status_expected
    if ok:
        green(f"[{status}] {name}")
    else:
        red(f"[{status} expected {status_expected}] {name}")
        info(f"Response: {str(data)[:300]}")
    return ok

ALL_PASSED = True
def check(cond, msg):
    global ALL_PASSED
    if cond:
        green(f"  {msg}")
    else:
        red(f"  {msg}")
        ALL_PASSED = False

# ─── Test 1: Projects CRUD ────────────────────────────────────────────────────

def test_projects():
    print("\n" + "="*60)
    print("📁 Test 1: Projects CRUD")
    print("="*60)

    # Create project (returns 201 Created)
    status, data = req("POST", "/api/projects", json={"name": "测试项目", "description": "脱口秀文稿集"})
    check(status == 201, f"Create project (got {status})")
    pid = data.get("id")
    check(pid is not None, f"Project ID returned: {pid}")

    # List projects
    status, data = req("GET", "/api/projects")
    check(status == 200 and isinstance(data, list), "List projects")
    check(any(p["id"] == pid for p in data), "New project appears in list")

    # Update project
    status, data = req("PATCH", f"/api/projects/{pid}", json={"name": "测试项目（已修改）"})
    check(status == 200 and data["name"] == "测试项目（已修改）", "Update project name")

    # Delete project
    status, _ = req("DELETE", f"/api/projects/{pid}")
    check(status == 204, "Delete project")

    # Create fresh project for other tests
    status, data = req("POST", "/api/projects", json={"name": "正式测试项目", "description": ""})
    check(status == 201, "Create fresh project for tests")
    pid = data.get("id")
    check(pid is not None, f"Fresh project ID: {pid}")
    return pid

# ─── Test 2: Script Upload ───────────────────────────────────────────────────

SAMPLE_SCRIPT = """
【演员】何广智
【节目】脱口秀大会 第五季
【标题】关于内卷的思考

我今天想聊聊内卷这个事。

你知道吗，现在连睡觉都在内卷。我朋友说，他每天晚上躺下之后，还要在床上刷一个小时的手机，才能安心入睡。

这就是一种内卷。明明睡觉是一个放松的事情，结果我们连睡觉都要卷。

而且内卷这个事情吧，它有一个特点，就是你一旦开始卷，就停不下来了。

举个例子，我之前跑步，一开始就是想锻炼身体。结果跑着跑着，我发现朋友圈里有人每天跑五公里。

然后我就想，我要不要也跑五公里？然后我就卷起来了。现在我每天跑十公里，其实我一点都不享受跑步的过程。

但是没办法，卷到这个份上了，你不跑就觉得输了。

这就是内卷的可怕之处——它让你忘了你当初为什么要开始。

其实我们做任何事情都是这样。一开始是为了开心，后来就变成了一场军备竞赛。

所以我现在想通了，不卷了。躺平才是终极目标。
"""

def test_scripts(pid):
    print("\n" + "="*60)
    print("📄 Test 2: Script Upload & List")
    print("="*60)

    # Upload script — project_id goes as query param, file as multipart
    import io
    files = {"file": ("何广智_内卷.txt", SAMPLE_SCRIPT.encode("utf-8"), "text/plain")}
    status, data = req("POST", f"/api/scripts/upload?project_id={pid}", files=files)
    check(status == 201, f"Upload script (got {status}): {str(data)[:100]}")
    sid = data.get("id") if isinstance(data, dict) else None
    check(sid is not None, f"Script ID: {sid}")

    # List scripts in project
    status, data = req("GET", f"/api/scripts?project_id={pid}")
    check(status == 200, "List scripts in project")
    check(any(s["id"] == sid for s in data if isinstance(data, list) and isinstance(s, dict)), "Script in list")

    # Get script detail
    status, data = req("GET", f"/api/scripts/{sid}")
    check(status == 200, "Get script detail")
    check("actor_name" in data or "segments" in data, "Script has expected fields")

    return sid

# ─── Test 3: Analysis Pipeline ───────────────────────────────────────────────

def test_analysis(sid):
    print("\n" + "="*60)
    print("🔍 Test 3: Analysis Pipeline")
    print("="*60)

    # Trigger analysis
    status, data = req("POST", f"/api/scripts/{sid}/analyze")
    check(status == 201, f"Trigger analysis (got {status})")
    jid = data.get("job_id") if isinstance(data, dict) else data if isinstance(data, int) else None
    if isinstance(data, dict):
        jid = data.get("job_id") or data.get("id")
    check(jid is not None, f"Job ID: {jid}")

    # Poll job status (SSE endpoint)
    status, data = req("GET", f"/api/jobs/{jid}")
    check(status == 200, "Get job status")

    # Get analysis result (may need to wait for completion)
    for attempt in range(20):
        status, data = req("GET", f"/api/scripts/{sid}/analysis")
        if status == 200 and data:
            break
        info(f"  Waiting for analysis... attempt {attempt+1}/20")
        time.sleep(3)

    check(status == 200, "Analysis result retrieved")
    if isinstance(data, dict):
        check("segments" in data or "report" in data, "Analysis has segments/report")
        info(f"  Segments: {len(data.get('segments', []))}")
        info(f"  Report: {'yes' if data.get('report') else 'no'}")
    return jid

# ─── Test 4: Segment Analysis ───────────────────────────────────────────────

def test_segments(sid):
    print("\n" + "="*60)
    print("🏷️  Test 4: Segment & Tag Filtering")
    print("="*60)

    # Get all segments
    status, data = req("GET", f"/api/scripts/{sid}/analysis")
    check(status == 200, "Get analysis for segment lookup")

    if isinstance(data, dict) and data.get("segments"):
        seg = data["segments"][0]
        seg_id = seg.get("id")
        info(f"  Testing segment ID: {seg_id}")

        # Get single segment analysis
        if seg_id:
            status, data = req("GET", f"/api/segments/{seg_id}/analysis")
            check(status == 200, "Get single segment analysis")

    # Filter by tags
    filter_payload = {
        "script_id": sid,
        "techniques": ["类比", "对比"],
        "page": 1,
        "page_size": 20
    }
    status, data = req("POST", "/api/search/filter", json=filter_payload)
    check(status == 200, "Filter by technique tags")

# ─── Test 5: Export ──────────────────────────────────────────────────────────

def test_export(sid):
    print("\n" + "="*60)
    print("📤 Test 5: Export (JSON / MD / DOCX)")
    print("="*60)

    for fmt in ["json", "md", "docx"]:
        status, data = req("POST", f"/api/scripts/{sid}/export",
                          json={"format": fmt, "script_id": sid,
                                "include_raw": True, "include_analysis": True})
        check(status == 200, f"Export as {fmt}")
        if fmt == "json" and isinstance(data, dict):
            check("segments" in data or "report" in data, f"  {fmt} export has content")

# ─── Test 6: API Docs ───────────────────────────────────────────────────────

def test_api_docs():
    print("\n" + "="*60)
    print("📚 Test 6: API Documentation")
    print("="*60)
    status, _ = req("GET", "/docs")
    check(status == 200, "Swagger UI available at /docs")
    status, _ = req("GET", "/openapi.json")
    check(status == 200, "OpenAPI schema at /openapi.json")

# ─── Test 7: Error Handling ─────────────────────────────────────────────────

def test_errors():
    print("\n" + "="*60)
    print("⚠️  Test 7: Error Handling")
    print("="*60)

    # 404/405 for non-existent project (no GET /projects/{id} route)
    status, data = req("GET", "/api/projects/99999")
    check(status in (404, 405), f"404/405 for non-existent project (got {status})")

    # 404 for non-existent script
    status, data = req("GET", "/api/scripts/99999")
    check(status == 404, "404 for non-existent script")

    # Create project without name (should fail)
    status, data = req("POST", "/api/projects", json={})
    check(status >= 400, "Reject empty project creation")

# ─── Main ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("🎤 脱口秀拉片分析系统 - 全功能测试")
    print(f"Backend: {BASE}")

    # Check backend is up
    try:
        r = requests.get(f"{BASE}/docs", timeout=5)
        check(r.status_code == 200, "Backend is reachable")
    except Exception as e:
        red(f"Backend not reachable: {e}")
        sys.exit(1)

    # Run tests
    pid = test_projects()
    if pid:
        sid = test_scripts(pid)
        if sid:
            test_analysis(sid)
            test_segments(sid)
            test_export(sid)
    test_api_docs()
    test_errors()

    print("\n" + "="*60)
    if ALL_PASSED:
        green("🎉 所有测试通过！")
    else:
        red("⚠️  部分测试失败，请检查日志")
    print("="*60 + "\n")
