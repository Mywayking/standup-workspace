"""
Regression tests: ensure long scripts (1000+ chars) don't regress.
安徽大姐 = 1092 chars, triggers long MiniMax thinking block boundary case.
"""
import pytest, json, subprocess, time

ANHUI_DAXIE = "就前几天我坐地铁无意听到一段对话，很有意思。当时是两个人，一男一女，那个大姐说，虽然我们是安徽滴，但我们是、淮南市里的。这里可能需要解释一下，淮南是安徽的一个地级市，属于安徽。这个大姐这句话的意思是，虽然安徽不如上海，但我们淮南比起安徽其他地方、嗯~还是要高级一些的。这句话有点像是，一个上海人说，虽然我是嘉定的，但是南翔片区的。说实话，当时我真的有点被大姐的这种乐观的精神打动了。她真的很乐观哈。当时车厢有很多人，我为什么能听到这句话呢，因为我、喜欢偷听别人讲话，还有一个原因我就是安徽人。安徽在上海口碑不是很好对吧，我知道的不用骗我。要证明口碑不好这个事情很简单，想象一下，你在找对象的时候，两个人，其他条件都一样，一个安徽人，一个上海人，你会选哪个就知道了。很简单对吧，我自己都不选安徽。这个家是淮南市里的大姐让我有了一点点思考。就是一部分为什么会瞧不起另外一部分人，会有优越感。我想了很久，发现这个会歧视别人的人，都因为他自己、先感受到了另外一些人对他的歧视，他才会想着歧视别人。如果她从来没有感受到过这种歧视，她是不会这么说的【虽然】我们是安徽滴。这世界上从来没有无缘无故的爱，也没有无缘无故的歧视大姐她不是歧视的创造者，她只是歧视的中间商。她不生产歧视，他只是歧视的搬运工。后面她那半句但是我们淮南市里的。是为了缓解这种被歧视的压力，她需要把这个压力释放出去。这就叫力力皆辛苦朋友们。这就跟上班一样的，压力会一层一层向下传递。老板把压力传给总监，总监给到组长，组长给你们，你们压力大了就来剧场，这样盯着演员看，也可以把压力释放出去。我还发现，歧视有可能是人类独有的现象。其他的动物，猫啊狗啊都不会这样的。一个地方的狗是不会瞧不起另外一个地方的狗的，因为它们脑子里没有高低贵贱的概念。它们感受不到其他狗的歧视，所以也不会歧视其他的狗。他们只要闻闻对方的屁股就能成为好朋友。但一个地方的人可能会歧视的另外一个地方的人，即使他都没去过那个地方，也认识不了几个那个地方的人，但他就是会有一种莫名其妙的优越感。我觉得我找到了这个问题的原因，但却解决不了这个问题。如果我跟大家人人平等，应该相互关爱。你们会觉得我说的是屁话，都是说教，没有卵用。我想了很久也没有找到解决歧视的方法。但有一个方法可以消除一些，因为别人的优越感给你带来的不舒服。分享给大家。那就是就想一下，他这个优越感的来源是什么，不过是其他人对他歧视的转移罢了。当然反过来也一样，我们忍不住对别人产生的优越感的时候，也想一下，也是一样的。都是是很糟糕的东西，就不要再继续传下去了。实在不行就记住：有优越感的人，狗都不如。"

SHORT_JOKE = "我上次去相亲，对面姑娘问我有什么爱好，我说写代码。她问我那你休闲娱乐也写代码吗？我说不，我休闲娱乐写的是bug。"

BACKEND_URL = "http://127.0.0.1:8000"


def test_short_joke_non_streaming():
    """Short script non-streaming: basic smoke test."""
    r = subprocess.run(
        ["curl", "-s", "--max-time", "90", "-X", "POST",
         f"{BACKEND_URL}/api/analyze",
         "-H", "Content-Type: application/json",
         "-d", json.dumps({"text": SHORT_JOKE, "mode": "quick"})],
        capture_output=True, text=True, timeout=95
    )
    d = json.loads(r.stdout)
    ev = d.get("evaluation") or {}
    assert len(ev) == 8, f"8维缺失: {ev}"
    assert len(d.get("segments", [])) >= 1
    assert len(d.get("script_changes", [])) >= 1


def test_anhui_daxie_non_streaming():
    """Long script non-streaming: 安徽大姐 1092 chars, triggers long thinking block."""
    r = subprocess.run(
        ["curl", "-s", "--max-time", "120", "-X", "POST",
         f"{BACKEND_URL}/api/analyze",
         "-H", "Content-Type: application/json",
         "-d", json.dumps({"text": ANHUI_DAXIE, "mode": "quick"})],
        capture_output=True, text=True, timeout=125
    )
    d = json.loads(r.stdout)
    ev = d.get("evaluation") or {}
    assert len(ev) == 8, f"长段子8维缺失: {ev}"
    assert len(d.get("segments", [])) >= 1, "段落分析缺失"
    assert len(d.get("script_changes", [])) >= 1, "改写建议缺失"


def test_anhui_daxie_streaming():
    """Long script streaming: verify event:done JSON parsing is correct."""
    proc = subprocess.Popen(
        ["curl", "-s", "--max-time", "120", "-X", "POST",
         f"{BACKEND_URL}/api/analyze/stream",
         "-H", "Content-Type: application/json",
         "-d", json.dumps({"text": ANHUI_DAXIE, "mode": "quick"})],
        stdout=subprocess.PIPE, text=True, timeout=125
    )
    done_data = None
    for line in proc.stdout:
        line = line.strip()
        if line.startswith("event: done"):
            continue
        if line.startswith("data:") and done_data is None:
            raw = line[5:].strip()
            try:
                done_data = json.loads(raw)
                break
            except json.JSONDecodeError:
                pass

    assert done_data is not None, "流式接口未收到 done 事件"
    ev = done_data.get("evaluation") or {}
    assert len(ev) == 8, f"流式长段子8维缺失: {ev}"
    assert len(done_data.get("segments", [])) >= 1
    assert len(done_data.get("script_changes", [])) >= 1


if __name__ == "__main__":
    print("=== 回归测试 ===")
    print(f"段子长度: 短={len(SHORT_JOKE)}字, 安徽大姐={len(ANHUI_DAXIE)}字")

    print("\n[1/3] 短段子非流式...")
    test_short_joke_non_streaming()
    print("✅ 通过")

    print("\n[2/3] 安徽大姐非流式...")
    test_anhui_daxie_non_streaming()
    print("✅ 通过")

    print("\n[3/3] 安徽大姐流式...")
    test_anhui_daxie_streaming()
    print("✅ 通过")

    print("\n✅ 全部通过！")
