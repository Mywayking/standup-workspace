import subprocess, json, sys

text = "就前几天我坐地铁无意听到一段对话。安徽大姐说虽然我们是安徽滴，但我们是淮南市里的。"

result = subprocess.run(
    ["curl", "-s", "--max-time", "30", "-X", "POST",
     "https://api.minimax.chat/v1/chat/completions",
     "-H", f"Authorization: Bearer {open('/root/standup-workspace/backend/.env').read().split('MINIMAX_API_KEY=')[1].split(chr(10))[0]}",
     "-H", "Content-Type: application/json",
     "-d", json.dumps({
         "model": "MiniMax-M2.7",
         "messages": [{"role": "user", "content": f"段子内容：{text}\n\n严格按JSON格式返回，不要输出其他文字：{{\"evaluation\":{{\"观点和立场\":\"test\"}}}}"}],
         "max_tokens": 6000, "temperature": 0.2
     })],
    capture_output=True, text=True, timeout=35
)
d = json.loads(result.stdout)
content = d["choices"][0]["message"]["content"]
print("finish:", d["choices"][0].get("finish_reason"))
print("Content length:", len(content))
# Find JSONs
complete = []
count = 0; in_str = False; esc = False; js = -1
for i, ch in enumerate(content):
    if esc: esc=False; continue
    if ch=='\\' and in_str: esc=True; continue
    if ch=='"' and not esc: in_str=not in_str; continue
    if in_str: continue
    if ch=='{':
        if count==0: js=i
        count+=1
    elif ch=='}':
        count-=1
        if count==0 and js>=0:
            try: complete.append(json.loads(content[js:i+1]))
            except: pass
            js=-1
print("Complete JSONs:", len(complete))
if complete:
    print("Keys:", list(complete[-1].keys()))
    print("SUCCESS")
else:
    print("FAIL - no complete JSON")
    print("Content[:300]:", repr(content[:300]))
