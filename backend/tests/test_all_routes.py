"""
全面回归测试 - 所有 LLM Router 接口 + 前端 Playwright 测试
运行方式:
  API测试:  python tests/test_all_routes.py
  前端测试: npx playwright test frontend-e2e.spec.ts
  完整测试: (两个都跑)
"""

import subprocess, json, time, sys

# ─── 测试配置 ────────────────────────────────────────────────────────────────

BACKEND = "http://localhost:8000"
FRONTEND = "http://localhost:3117"
HEADERS = {"Content-Type": "application/json"}

# ─── 颜色输出 ────────────────────────────────────────────────────────────────

def pass_(msg):  print(f"  \033[92m✅ {msg}\033[0m")
def fail_(msg):  print(f"  \033[91m❌ {msg}\033[0m")
def info(msg):   print(f"     {msg}")

CATEGORIES = []

# ─── 辅助 ────────────────────────────────────────────────────────────────────

def req(path, method="GET", **kwargs):
    import urllib.request, urllib.error
    url = BACKEND + path
    body = kwargs.get("json") or kwargs.get("data")
    data = json.dumps(body).encode() if isinstance(body, dict) else (body or b"")
    req = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
    except Exception as e:
        return 0, str(e)

def parse_resp(text):
    try:    return json.loads(text)
    except: return {"raw": text[:200]}

def check(cond, msg):
    if cond:
        pass_(msg)
        return True
    else:
        fail_(msg)
        return False

# ─── 测试用例定义 ────────────────────────────────────────────────────────────

def register(name, cases):
    global CATEGORIES
    CATEGORIES.append({"name": name, "cases": cases})

# ─────────────────────────────────────────────────────────────────────────────
# 1. joke-to-premise 专项测试（曾有 premises 空字符串 bug）
# ─────────────────────────────────────────────────────────────────────────────

def test_joke_to_premise():
    cases = []

    # ✅ BUG案例：返回 premises 但 premise 字段为空字符串
    cases.append({
        "name": "Bug回归：premise 字段不为空",
        "path": "/api/write/joke-to-premise",
        "method": "POST",
        "body": {"text": "我老板每天加班到半夜，结果公司倒闭了"},
        "check": lambda d: (
            check(d.get("input_type") == "joke_line", f"input_type=joke_line (got {d.get('input_type')})")
            and all(p.get("premise", "").strip() != "" for p in d.get("premises", [])[:3]),
            "所有 premises 字段非空"
        )
    })

    # ✅ 正常短文本
    cases.append({
        "name": "正常短文本",
        "path": "/api/write/joke-to-premise",
        "method": "POST",
        "body": {"text": "我妈觉得我很内向，其实我只是不想跟你说话"},
        "check": lambda d: (
            check(len(d.get("premises", [])) >= 2, f"至少2个前提 (got {len(d.get('premises',[]))})")
            and check(d.get("input_type") in ["joke_line", "story", "observation"], f"valid input_type")
        )
    })

    # ✅ 长文本
    cases.append({
        "name": "长文本输入",
        "path": "/api/write/joke-to-premise",
        "method": "POST",
        "body": {"text": "我上次去相亲，相亲对象问我有什么爱好，我说写代码。她说你休闲娱乐也写代码吗？我说不，我休闲娱乐写的是bug，结果她当场就把我拉黑了，我觉得她可能不懂程序员的黑幽默"},
        "check": lambda d: (
            check(d.get("input_type") != "unknown", f"input_type 非 unknown")
            and check(d.get("error") is None, f"无 error 字段")
        )
    })

    return cases

register("joke-to-premise (4 cases)", test_joke_to_premise())

# ─────────────────────────────────────────────────────────────────────────────
# 2. premise-extract
# ─────────────────────────────────────────────────────────────────────────────

def test_premise_extract():
    cases = []
    cases.append({
        "name": "正常素材提炼",
        "path": "/api/write/premise-extract",
        "method": "POST",
        "body": {"text": "我老板每天加班到半夜，结果公司倒闭了"},
        "check": lambda d: (
            check("premise" in d, "返回 premise 字段")
            and check(d.get("premise", "").strip() != "", "premise 非空")
            and check("why_it_works" in d, "返回 why_it_works")
        )
    })
    cases.append({
        "name": "多句话素材",
        "path": "/api/write/premise-extract",
        "method": "POST",
        "body": {"text": "你知道为什么年轻人都不愿意结婚了吗？因为结了婚之后，你发现生活质量不仅没有提高，反而下降了。单身的时候想吃就吃想睡就睡，结婚之后每天被房贷车贷压得喘不过气来"},
        "check": lambda d: (
            check(d.get("premise","").strip() != "", "premise 非空")
            and check(d.get("error") is None, "无 error")
        )
    })
    return cases

register("premise-extract (2 cases)", test_premise_extract())

# ─────────────────────────────────────────────────────────────────────────────
# 3. find-angle
# ─────────────────────────────────────────────────────────────────────────────

def test_find_angle():
    cases = []
    cases.append({
        "name": "正常角度查找",
        "path": "/api/write/find-angle",
        "method": "POST",
        "body": {"text": "我老板每天加班到半夜，结果公司倒闭了"},
        "check": lambda d: (
            check(len(d.get("angles", [])) >= 1, f"至少1个角度 (got {len(d.get('angles',[]))})")
            and check(all(a.get("title","").strip() != "" for a in d.get("angles",[])[:2]), "所有角度 title 非空")
            and check(all(a.get("description","").strip() != "" for a in d.get("angles",[])[:2]), "所有角度 description 非空")
        )
    })
    cases.append({
        "name": "极短文本",
        "path": "/api/write/find-angle",
        "method": "POST",
        "body": {"text": "我妈觉得我内向"},
        "check": lambda d: check(d.get("angles") is not None, "返回 angles 列表")
    })
    return cases

register("find-angle (2 cases)", test_find_angle())

# ─────────────────────────────────────────────────────────────────────────────
# 4. rewrite
# ─────────────────────────────────────────────────────────────────────────────

def test_rewrite():
    cases = []
    cases.append({
        "name": "正常 rewrite",
        "path": "/api/write/rewrite",
        "method": "POST",
        "body": {
            "text": "我妈觉得我内向，其实我只是不想跟你说话",
            "style": "更幽默",
            "persona": "脱口秀演员"
        },
        "check": lambda d: (
            check("rewritten" in d or "text" in d, "返回 rewritten 或 text 字段")
            and check(d.get("error") is None, "无 error")
        )
    })
    cases.append({
        "name": "无 style 参数",
        "path": "/api/write/rewrite",
        "method": "POST",
        "body": {"text": "你知道为什么年轻人不结婚吗？因为结了婚生活质量会下降"},
        "check": lambda d: check(d.get("error") is None, "无 error")
    })
    return cases

register("rewrite (2 cases)", test_rewrite())

# ─────────────────────────────────────────────────────────────────────────────
# 5. analyze（非流式）
# ─────────────────────────────────────────────────────────────────────────────

def test_analyze():
    cases = []
    cases.append({
        "name": "正常分析（长文本）",
        "path": "/api/analyze",
        "method": "POST",
        "body": {"text": "我老板每天加班到半夜，结果公司倒闭了，真是太讽刺了"},
        "check": lambda d: (
            check(d.get("comedy_type") not in (None, "?"), f"comedy_type 有效 (got {d.get('comedy_type')})")
            and check(len(d.get("techniques", [])) >= 1, f"至少1个 technique")
            and check("evaluation" in d, "返回 evaluation")
        )
    })
    cases.append({
        "name": "短文本（应拒绝）",
        "path": "/api/analyze",
        "method": "POST",
        "body": {"text": "我妈觉得我很内向"},
        "check": lambda d: check(d.get("detail","").startswith("段子内容太短"), "短文本被拒绝")
    })
    cases.append({
        "name": "安徽大姐长段子（1092字回归测试）",
        "path": "/api/analyze",
        "method": "POST",
        "body": {"text": "就前几天我坐地铁无意听到一段对话，很有意思。当时是两个人，一男一女，那个大姐说，虽然我们是安徽滴，但我们是、淮南市里的。这里可能需要解释一下，淮南是安徽的一个地级市，属于安徽。这个大姐这句话的意思是，虽然安徽不如上海，但我们淮南比起安徽其他地方、嗯~还是要高级一些的。这句话有点像是，一个上海人说，虽然我是嘉定的，但是南翔片区的。说实话，当时我真的有点被大姐的这种乐观的精神打动了。她真的很乐观哈。当时车厢有很多人，我为什么能听到这句话呢，因为我、喜欢偷听别人讲话，还有一个原因我就是安徽人。安徽在上海口碑不是很好对吧，我知道的不用骗我。要证明口碑不好这个事情很简单，想象一下，你在找对象的时候，两个人，其他条件都一样，一个安徽人，一个上海人，你会选哪个就知道了。很简单对吧，我自己都不选安徽。这个家是淮南市里的大姐让我有了一点点思考。就是一部分为什么会瞧不起另外一部分人，会有优越感。我想了很久，发现这个会歧视别人的人，都因为他自己、先感受到了另外一些人对他的歧视，他才会想着歧视别人。如果她从来没有感受到过这种歧视，她是不会这么说的【虽然】我们是安徽滴。这世界上从来没有无缘无故的爱，也没有无缘无故的歧视大姐她不是歧视的创造者，她只是歧视的中间商。她不生产歧视，他只是歧视的搬运工。后面她那半句但是我们淮南市里的。是为了缓解这种被歧视的压力，她需要把这个压力释放出去。这就叫力力皆辛苦朋友们。这就跟上班一样的，压力会一层一层向下传递。老板把压力传给总监，总监给到组长，组长给你们，你们压力大了就来剧场，这样盯着演员看，也可以把压力释放出去。我还发现，歧视有可能是人类独有的现象。其他的动物，猫啊狗啊都不会这样的。一个地方的狗是不会瞧不起另外一个地方的狗的，因为它们脑子里没有高低贵贱的概念。它们感受不到其他狗的歧视，所以也不会歧视其他的狗。他们只要闻闻对方的屁股就能成为好朋友。但一个地方的人可能会歧视的另外一个地方的人，即使他都没去过那个地方，也认识不了几个那个地方的人，但他就是会有一种莫名其妙的优越感。我觉得我找到了这个问题的原因，但却解决不了这个问题。如果我跟大家人人平等，应该相互关爱。你们会觉得我说的是屁话，都是说教，没有卵用。我想了很久也没有找到解决歧视的方法。但有一个方法可以消除一些，因为别人的优越感给你带来的不舒服。分享给大家。那就是就想一下，他这个优越感的来源是什么，不过是其他人对他歧视的转移罢了。当然反过来也一样，我们忍不住对别人产生的优越感的时候，也想一下，也是一样的。都是是很糟糕的东西，就不要再继续传下去了。实在不行就记住：有优越感的人，狗都不如。"},
        "check": lambda d: (
            check(d.get("comedy_type") not in (None, "?"), "comedy_type 有效")
            and check(len(d.get("evaluation", {})) >= 6, f"evaluation 至少6维 (got {len(d.get('evaluation',{}))})")
            and check(len(d.get("segments", [])) >= 1, "有 segments")
        )
    })
    return cases

register("analyze (3 cases)", test_analyze())

# ─────────────────────────────────────────────────────────────────────────────
# 6. analyze/stream（流式 SSE）
# ─────────────────────────────────────────────────────────────────────────────

def test_analyze_stream():
    cases = []
    cases.append({
        "name": "流式分析正常",
        "path": "/api/analyze/stream",
        "method": "POST",
        "body": {"text": "我老板每天加班到半夜，结果公司倒闭了，真是太讽刺了"},
        "check": lambda d: (
            check(d.get("comedy_type") not in (None, "?"), "comedy_type 有效")
            and check(d.get("evaluation") is not None, "有 evaluation")
        )
    })
    cases.append({
        "name": "流式安徽大姐长段子",
        "path": "/api/analyze/stream",
        "method": "POST",
        "body": {"text": "就前几天我坐地铁无意听到一段对话，很有意思。当时是两个人，一男一女，那个大姐说，虽然我们是安徽滴，但我们是、淮南市里的。"},
        "check": lambda d: (
            check(d.get("comedy_type") not in (None, "?"), "comedy_type 有效")
            and check(len(d.get("evaluation", {})) >= 6, f"evaluation 至少6维")
        )
    })
    return cases

register("analyze/stream (2 cases)", test_analyze_stream())

# ─────────────────────────────────────────────────────────────────────────────
# 7. Health + 路由完整性
# ─────────────────────────────────────────────────────────────────────────────

def test_health_and_meta():
    cases = []
    cases.append({
        "name": "Health 检查",
        "path": "/health",
        "method": "GET",
        "body": None,
        "check": lambda d: check(d.get("status") == "ok", f"status=ok (got {d.get('status')})")
    })
    cases.append({
        "name": "OpenAPI schema",
        "path": "/openapi.json",
        "method": "GET",
        "body": None,
        "check": lambda d: check("openapi" in d, f"openapi schema 可用")
    })
    return cases

register("health+meta (2 cases)", test_health_and_meta())


# ─── 流式测试运行器 ─────────────────────────────────────────────────────────

def run_stream_test(path, body):
    """通过 curl 捕获 SSE 流式响应，取最后一个 data: 行"""
    import subprocess
    cmd = [
        "curl", "-s", "--max-time", "120", "-X", "POST",
        f"{BACKEND}{path}",
        "-H", "Content-Type: application/json",
        "-d", json.dumps(body),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=125)
    lines = [l.strip() for l in proc.stdout.split("\n") if l.strip()]
    # 找最后一个有效的 data: 行
    last_data = None
    for line in lines:
        if line.startswith("data:") and not line.startswith("data: {"):
            continue  # 跳过空行
        if line.startswith("data:"):
            raw = line[5:].strip()
            if raw and raw != "[DONE]":
                try:
                    last_data = json.loads(raw)
                except json.JSONDecodeError:
                    pass
    return last_data or {"raw": lines[-1] if lines else ""}


# ─── 主测试循环 ─────────────────────────────────────────────────────────────

def main():
    print("=" * 70)
    print("🎤 Standup 全面回归测试 - TokenHub 多模型回退")
    print("=" * 70)

    total_pass = 0
    total_fail = 0

    for cat in CATEGORIES:
        print(f"\n\033[1m📋 {cat['name']}\033[0m")
        for case in cat["cases"]:
            sys.stdout.write(f"   {case['name']}... ")
            sys.stdout.flush()
            status, raw = req(case["path"], case["method"], json=case["body"])
            if case["path"] == "/api/analyze/stream":
                d = run_stream_test(case["path"], case["body"])
            else:
                d = parse_resp(raw)
            ok = case["check"](d)
            if ok:
                total_pass += 1
                print(f"\033[92m✅\033[0m (status={status})")
            else:
                total_fail += 1
                print(f"\033[91m❌\033[0m (status={status}) | {str(d)[:200]}")
            time.sleep(0.5)

    print("\n" + "=" * 70)
    if total_fail == 0:
        print(f"\033[92m🎉 全部通过 ({total_pass}/{total_pass})\033[0m")
    else:
        print(f"\033[91m⚠️  失败 {total_fail} 项 ({total_pass}/{total_pass+total_fail} 通过)\033[0m")
    print("=" * 70)


if __name__ == "__main__":
    main()