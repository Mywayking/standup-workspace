# standup-workspace 异常态与流式稳定性技术方案

版本：2026-04-23  
范围：`/write` 页面核心创作链路（提炼前提 / 梗写前提 / 找角度 / 改稿）

---

## 1. 背景与目标

近期三类线上问题反复出现：

1. 网络类失败直接暴露给用户：`network error`、`Load failed`
2. 中间态或错误态泄露内部协议内容：`\uXXXX`、JSON 字段碎片、内部结构字段
3. 长请求超时：如“请求超时（180秒）”

本方案目标：

- 让用户不再看到底层技术错误原文
- 让 SSE / 长请求链路更稳定，可定位、可降级
- 把前端中间态、错误态、调试态彻底分层
- 让移动端 Safari 与桌面端表现一致

---

## 2. 当前代码现状判断

### 2.1 模型调用现状

当前仓库 README 仍把分析层写成 MiniMax / `mmx CLI`，但代码中至少 `joke_to_premise` 路由已经明确直接调用 `https://api.deepseek.com/chat/completions`，模型名为 `deepseek-chat`。这说明“文档口径”和“实际运行口径”已经不一致，必须统一。  

### 2.2 已出现的问题模式

#### 模式 A：网络失败
典型表现：
- `network error`
- `Load failed`
- `Failed to fetch`

说明请求没有成功拿到可用响应，可能发生在：
- 前端到 `/api/*` 路由层
- 反向代理 / Nginx / CDN
- 后端到 DeepSeek
- 流式链路中途断开

#### 模式 B：内部 payload 泄露
典型表现：
- `\u53xx` 一类 Unicode 转义串
- `theme`、`attitude`、`premise_candidates`、`script_changes` 等内部字段

说明前端直接显示了：
- 原始 SSE token
- 原始错误详情
- 未解析 JSON
- 未解码 Unicode 的字符串

#### 模式 C：超时
典型表现：
- `请求超时（180秒）`

说明当前存在“长时间无有效进展提示”的同步等待问题，前端最终主动 abort。

---

## 3. 根因拆解

### 3.1 前端层根因

1. 各 Tab / 公共组件的错误处理口径不统一
2. 某些页面把 `stream.error` 或 `displayText` 直接显示给用户
3. 缺少统一的 Unicode decode 与 internal payload 识别工具
4. 缺少统一的 error schema 解析层
5. 某些页面仍展示 token 级流，而不是阶段级状态

### 3.2 后端层根因

1. DeepSeek 调用耗时、断流、限流、上游失败时，返回格式不稳定
2. 流式路由没有形成统一的 progress / analysis / done / error 协议约束
3. 缺少 request id、耗时、阶段日志，难以定位失败层级
4. 超时策略没有分层（首响应超时、模型超时、总超时）

### 3.3 基础设施层根因

1. `/api/*` 到后端的代理链路可能在移动端 / Safari / SSE 场景下不稳定
2. 反向代理对 `text/event-stream` 处理可能存在缓冲、读超时、连接中断问题
3. HTTPS / 跨域 / 预检在移动端更容易暴露问题

---

## 4. 总体技术方案

按四个模块推进：

1. 错误态统一治理
2. SSE / 流式链路稳定性治理
3. DeepSeek 调用降级与超时治理
4. 移动端 Safari 兼容专项

---

## 5. 模块一：错误态统一治理

### 5.1 目标

- 用户只看到用户态文案
- 开发调试信息保留，但默认折叠
- 全站不再直接显示 `network error` / `Load failed` / `\uXXXX`

### 5.2 前端新增公共工具

建议新增：

- `frontend/src/lib/error/getUserFriendlyError.ts`
- `frontend/src/lib/error/extractErrorPayload.ts`
- `frontend/src/lib/text/decodePossiblyEscapedText.ts`
- `frontend/src/lib/text/looksLikeInternalPayload.ts`

### 5.3 统一错误映射

#### 输入示例
- `network error`
- `Load failed`
- `Failed to fetch`
- `AbortError`
- `timeout`
- JSON 格式错误对象

#### 输出规范
- 网络连接异常，请稍后重试。
- 请求超时了，请稍后再试。
- 请求已中断，请重新发起。
- 生成失败了，请稍后重试。

### 5.4 错误卡片 UI 规范

统一卡片结构：

- 标题：`生成失败`
- 副文案：用户可理解错误
- 主按钮：`重新生成`
- 次按钮：`返回编辑` / `复制错误信息`
- 调试折叠区：仅开发环境或手动展开显示原始 detail

### 5.5 Unicode / JSON 展示规范

所有展示到用户页面的动态文本，必须先经过：

1. `decodePossiblyEscapedText()`
2. `extractErrorPayload()`
3. `looksLikeInternalPayload()` 判断

如果仍命中内部协议特征，则降级为固定文案：
- 正在分析素材…
- 正在生成前提候选…
- 正在诊断段子结构…

---

## 6. 模块二：SSE / 流式链路稳定性治理

### 6.1 统一事件协议

所有流式路由统一只允许以下事件类型：

- `progress`：阶段提示
- `analysis`：结构化中间摘要
- `done`：最终结果
- `error`：稳定错误对象
- `heartbeat`：心跳

禁止把原始 token 直接暴露到用户界面。

### 6.2 前端展示策略

#### 用户态展示
- `progress`：显示阶段文案
- `analysis`：显示结构化摘要
- `done`：显示正式结果
- `error`：显示标准错误卡片

#### 非用户态展示
- `token`：如果后端仍保留，只供内部调试；默认不渲染

### 6.3 流式心跳

后端长请求超过 5~8 秒未有新结果时，必须发送 `heartbeat` 或 `progress`，避免前端长时间无反馈。

### 6.4 代理层要求

Nginx / 网关必须确认：

- 支持 `text/event-stream`
- 关闭不必要缓冲
- 合理配置 `proxy_read_timeout`
- 不改写或截断流
- 移动端与桌面端走同一套可观测链路

---

## 7. 模块三：DeepSeek 调用降级与超时治理

### 7.1 当前问题

代码已表明至少部分创作链路明确调用 DeepSeek，但 README 仍保留 MiniMax 口径，且超时 / 回退策略尚未统一。

### 7.2 分层超时设计

推荐超时拆分：

- 前端首响应超时：20~30 秒
- 后端上游请求超时：60~90 秒
- 整体总超时：120 秒左右
- 每 5~8 秒必须有一次 progress / heartbeat

不再使用“用户空等 180 秒才失败”的单层策略。

### 7.3 降级策略

#### 降级一：流式失败 -> 非流式
当 SSE 失败时：
- 自动切换普通 JSON 请求
- 返回简化结果

#### 降级二：完整结果失败 -> 简化结果
例如：
- 找角度由 6 个降为 3 个
- 梗写前提只返回 1~2 条核心铺垫
- 改稿只返回诊断 + 1 版建议

#### 降级三：上游失败 -> 稳定 error schema
后端统一返回：

```json
{
  "error_code": "UPSTREAM_TIMEOUT",
  "message": "上游模型响应超时",
  "retryable": true,
  "request_id": "..."
}
```

### 7.4 结构化日志

所有模型调用统一日志：

- request_id
- route_name
- session_id
- step_name
- start_ts / end_ts
- duration_ms
- upstream_provider = deepseek
- model = deepseek-chat
- timeout_layer
- error_code
- retryable

---

## 8. 模块四：移动端 Safari 兼容专项

### 8.1 目标

重点解决：
- `Load failed`
- 移动端长请求感知差
- 详情文本过长、过脏

### 8.2 移动端专属要求

1. 错误卡片默认只显示用户文案
2. 调试详情默认折叠
3. 长请求必须显示阶段提示
4. 支持“重新生成”与“取消请求”
5. 避免移动端页面展示超长 detail / JSON

### 8.3 Safari 专项排查

必须验证：
- HTTPS 正常
- 无 mixed content
- 无 CORS / 预检失败
- SSE 在 Safari 真机下可持续接收
- 失败时后端日志能关联 request id

---

## 9. 代码改造建议

### 9.1 前端

#### `PremiseTab.tsx`
- 保持 token 不渲染策略
- 仅展示 progress / analysis / done
- 使用公共 decode + sanitize 工具

#### `AnglesTab.tsx`
- 统一错误映射，覆盖 `Load failed`
- 流式失败时尝试降级为非流式
- 不再直接展示 `String(err)`

#### `JokeToPremiseTab.tsx`
- 180 秒硬超时改为分层超时
- 增加首响应等待文案与中间进度
- 使用统一错误卡片

#### `WriteClient.tsx`
- 作为全站公共错误展示层
- 移除直接显示 `stream.error` / 原始 detail 的逻辑
- thinking 态统一改为阶段提示，不显示内部 payload

### 9.2 后端

#### `backend/app/routers/find_angles.py`
- 统一 progress / heartbeat / done / error 协议
- 增加 request id 与结构化日志
- 流式失败时支持 fallback

#### `backend/app/routers/joke_to_premise.py`
- 保留 DeepSeek 调用，但增加更清晰的 timeout / error_code / retryable 返回
- 增加 progress 心跳
- 优先返回简化结果，而不是长时间无响应

### 9.3 文档与配置

- README 里的模型层描述必须和当前真实运行口径一致
- 如果仍保留 MiniMax 路线，需要说明“历史架构 / 备用架构 / 当前生产架构”
- 环境变量命名统一，避免 README / 代码 / 部署脚本三套口径

---

## 10. 测试方案补强

现有测试更偏主流程与 happy path，缺少异常态与兼容性专项。需要补充一套专门测试。

### 10.1 新增测试包

名称建议：`异常态与兼容性专项测试`

### 10.2 覆盖范围

#### 网络异常
- 后端不可达
- 代理 502 / 504
- SSE 中途断开
- Safari 真机弱网

#### 错误对象展示
- 普通字符串错误
- JSON 错误对象
- 带 `\uXXXX` 的详情
- 超长 detail

#### 超时
- 首响应超时
- 中间阶段卡住
- 总超时

#### UI 验收
- 不展示原始异常原文
- 不展示 `\uXXXX`
- 不展示内部字段
- 有明确的重试与取消操作

---

## 11. 发布计划

### Phase 1（1 天）
- 统一错误映射
- 新增 decode / sanitize 公共工具
- 标准化错误卡片
- 停掉 token 直出

### Phase 2（1~2 天）
- 接入 request id
- 后端日志结构化
- 统一 SSE 协议
- 代理配置核查

### Phase 3（1~2 天）
- 流式失败 -> 非流式 fallback
- 分层超时
- progress / heartbeat
- Safari 真机回归

---

## 12. 验收标准

### 用户可见结果

上线后不得再出现：
- `network error`
- `Load failed`
- `请求超时（180秒）`
- `\u53xx` 一类转义串
- `script_changes / location / premise_candidates` 一类内部字段

### 工程指标

- 所有失败请求都能在日志中通过 request id 追踪
- SSE 请求 95% 在 10 秒内收到首个 progress / heartbeat
- 流式失败后可自动 fallback 到非流式

### 兼容性

- Chrome 桌面通过
- iPhone Safari 真机通过
- 移动端错误态展示一致

---

## 13. 一句话总结

这不是三个分散 bug，而是同一套“长链路流式调用 + 错误态治理缺失 + 移动端兼容不足”的系统性问题。正确修法不是按页面打补丁，而是统一模型调用链路、SSE 协议、前端错误展示与异常测试体系。
