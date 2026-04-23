# TokenHub 多模型容灾与观测技术方案

## 1. 背景与目标

当前站点核心创作链路依赖单一 DeepSeek 模型。现状问题：

- 单模型耗时波动大
- 上游偶发超时、限流、断流时，页面直接失败
- 页面无法感知当前实际使用的模型
- 后端缺乏跨模型耗时、失败率、切换率等统一观测

本方案目标：

1. 接入腾讯云 TokenHub 统一大模型网关
2. 支持多个主流模型按优先级依次调用
3. 单模型超时或失败后，自动切换到下一个模型
4. 页面端展示本次实际命中的模型名称
5. 记录每个模型的耗时、成功数、失败数、超时数、回退次数
6. 尽量不改动现有业务 Prompt 与页面主体交互，优先做网关层抽象

---

## 2. 本次接入模型范围

统一接入地址：

`POST https://tokenhub.tencentmaas.com/v1/chat/completions`

统一鉴权：

`Authorization: Bearer <TOKENHUB_API_KEY>`

首批支持模型：

- `glm-5`
- `kimi-k2.6`
- `deepseek-v3.2`
- `minimax-m2.7`

建议默认优先级（可配置）：

1. `glm-5`
2. `kimi-k2.6`
3. `deepseek-v3.2`
4. `minimax-m2.7`

说明：

- 这里的“优先级”不是固定死逻辑，应通过配置决定
- 后续可以按功能场景拆分模型链，例如“找角度”偏创意，“提炼前提”偏稳定
- 第一版先做全链路统一优先级，降低改造复杂度

---

## 3. 核心设计思路

## 3.1 设计原则

- **业务层不直接依赖具体模型名**
- **所有模型调用统一走一个 LLM Gateway**
- **失败切换发生在后端，不暴露给页面复杂逻辑**
- **前端只接收最终命中模型与执行结果**
- **统一埋点、统一日志、统一错误分类**

## 3.2 总体架构

```text
前端页面
  └─ /write 各 Tab
       └─ 请求业务接口（提炼前提 / 梗写前提 / 找角度 / 改稿）
            └─ Router / Service
                 └─ LLM Gateway（新增）
                      ├─ Model Attempt #1: glm-5
                      ├─ Model Attempt #2: kimi-k2.6
                      ├─ Model Attempt #3: deepseek-v3.2
                      └─ Model Attempt #4: minimax-m2.7
                           └─ TokenHub API

返回：
- 结果正文
- 实际命中模型
- 尝试链路摘要
- 耗时信息
```

---

## 4. 后端改造方案

## 4.1 新增统一 LLM Gateway 层

建议新增目录：

```text
backend/app/llm/
  ├─ gateway.py
  ├─ providers.py
  ├─ schemas.py
  ├─ metrics.py
  └─ errors.py
```

职责划分：

### `schemas.py`
定义统一请求/响应结构：

- `LLMMessage`
- `LLMRequest`
- `LLMResponse`
- `ModelAttempt`
- `GatewayResult`

### `errors.py`
统一错误分类：

- `LLMTimeoutError`
- `LLMRateLimitError`
- `LLMHTTPError`
- `LLMResponseFormatError`
- `LLMAllModelsFailedError`

### `providers.py`
实现 TokenHub 调用客户端：

- 统一拼接 URL
- 统一 header
- 统一 request body
- 统一 stream / non-stream 逻辑
- 统一异常转换

### `gateway.py`
实现多模型回退主流程：

- 按配置模型链依次尝试
- 单模型超时则切下一个
- 非重试型错误按策略决定是否切换
- 记录每次 attempt 的耗时与结果
- 返回最终成功结果或统一失败对象

### `metrics.py`
统一记录模型级指标：

- 成功数
- 失败数
- 超时数
- 平均耗时
- P95 耗时
- 回退触发数
- 最终命中次数

---

## 4.2 统一请求数据结构

建议统一请求结构：

```python
class LLMRequest(BaseModel):
    scene: str                 # extract_premise / find_angles / joke_to_premise / rewrite
    messages: list[LLMMessage]
    temperature: float = 0.7
    stream: bool = False
    timeout_seconds: float = 25.0
    candidate_models: list[str] | None = None
    request_id: str
```

说明：

- `scene` 用于后续做场景级模型策略
- `candidate_models` 可覆盖默认模型链
- `timeout_seconds` 是单模型 timeout，不是总 timeout
- `request_id` 用于日志链路追踪

---

## 4.3 多模型回退逻辑

建议第一版回退规则：

### 可回退错误
以下错误进入下一个模型：

- 请求超时
- 网络错误
- 5xx
- 429 / 限流
- 上游返回空结果
- JSON 解析失败
- 流式首包超时

### 不建议自动回退的错误
以下通常是业务或 prompt 问题，直接失败：

- 请求参数非法
- 鉴权失败
- messages 为空
- 明显的业务校验错误

### 回退伪代码

```python
for model in candidate_models:
    start = now()
    try:
        resp = call_tokenhub(model=model, ...)
        record_success(model, latency_ms)
        return success(resp, selected_model=model, attempts=attempts)
    except TimeoutError as e:
        record_timeout(model, latency_ms)
        attempts.append(...)
        continue
    except RetryableLLMError as e:
        record_failure(model, latency_ms, error_type=e.type)
        attempts.append(...)
        continue
    except NonRetryableLLMError as e:
        record_failure(model, latency_ms, error_type=e.type)
        raise
raise LLMAllModelsFailedError(attempts=attempts)
```

---

## 4.4 TokenHub 客户端封装

建议统一使用 `httpx.AsyncClient`。

示例封装：

```python
async def chat_completion(
    *,
    api_key: str,
    model: str,
    messages: list[dict],
    temperature: float = 0.7,
    stream: bool = False,
    timeout_seconds: float = 25.0,
) -> dict:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "stream": stream,
    }
    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        resp = await client.post(
            "https://tokenhub.tencentmaas.com/v1/chat/completions",
            headers=headers,
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()
```

---

## 4.5 模型配置化

建议通过配置文件或环境变量定义模型链：

```env
TOKENHUB_API_KEY=xxx
TOKENHUB_BASE_URL=https://tokenhub.tencentmaas.com/v1/chat/completions
LLM_FALLBACK_MODELS=glm-5,kimi-k2.6,deepseek-v3.2,minimax-m2.7
LLM_SINGLE_TIMEOUT_SECONDS=25
LLM_TOTAL_TIMEOUT_SECONDS=70
```

建议同时支持场景级配置：

```env
LLM_MODELS_EXTRACT_PREMISE=glm-5,kimi-k2.6,deepseek-v3.2
LLM_MODELS_FIND_ANGLES=kimi-k2.6,glm-5,deepseek-v3.2,minimax-m2.7
LLM_MODELS_JOKE_TO_PREMISE=glm-5,deepseek-v3.2
LLM_MODELS_REWRITE=minimax-m2.7,glm-5,kimi-k2.6
```

第一版可先只实现全局链，后续再扩展到场景级链。

---

## 4.6 返回结构改造

所有业务接口在响应里增加统一 metadata：

```json
{
  "content": "...最终文本...",
  "meta": {
    "selected_model": "kimi-k2.6",
    "request_id": "req_xxx",
    "latency_ms": 12840,
    "attempt_count": 2,
    "attempts": [
      {
        "model": "glm-5",
        "status": "timeout",
        "latency_ms": 25012
      },
      {
        "model": "kimi-k2.6",
        "status": "success",
        "latency_ms": 12840
      }
    ]
  }
}
```

对于流式接口，建议最后一个 `done` 事件增加：

```json
{
  "type": "done",
  "content": "...",
  "meta": {
    "selected_model": "kimi-k2.6",
    "latency_ms": 12840,
    "attempt_count": 2
  }
}
```

---

## 5. 前端改造方案

## 5.1 页面展示模型名称

需求：页面端显示 model 名称。

建议展示位置：

### 方案 A：结果卡片头部
在生成结果顶部展示轻量标签：

- 模型：`glm-5`
- 模型：`kimi-k2.6`

展示样式建议：
- 灰色胶囊标签
- 不抢主视觉
- 放在“结果标题 / 时间 / 来源链”附近

### 方案 B：分析中状态区
在 loading 阶段显示：

- 正在调用：`glm-5`
- `glm-5` 超时，已切换 `kimi-k2.6`

这对用户感知更强，但也更容易引发“系统很不稳定”的感受。

**建议第一版：只展示最终命中模型。**
调试视角可增加“查看尝试详情”。

---

## 5.2 前端状态字段扩展

现有各 Tab / WriteClient / WorkflowSessionPanel 中，补充以下字段：

```ts
type ResultMeta = {
  selectedModel?: string;
  requestId?: string;
  latencyMs?: number;
  attemptCount?: number;
  attempts?: {
    model: string;
    status: "success" | "timeout" | "failed";
    latencyMs: number;
  }[];
};
```

结果卡片对象中新增：

```ts
meta?: ResultMeta
```

---

## 5.3 交互建议

### 成功态
显示：
- 结果正文
- 模型名称
- 总耗时（可选）

例如：

- `由 kimi-k2.6 生成`
- `耗时 12.8s`

### 失败态
如果所有模型都失败，页面错误文案建议：

- “这次生成失败了，已尝试 4 个模型，请稍后重试。”

开发/运营调试可展开看：
- 每个模型的失败类型
- 每个模型耗时

---

## 6. 指标与观测方案

## 6.1 必须记录的模型级指标

按模型维度统计：

- `request_total`
- `success_total`
- `failure_total`
- `timeout_total`
- `fallback_trigger_total`
- `selected_total`
- `latency_ms_avg`
- `latency_ms_p50`
- `latency_ms_p95`
- `latency_ms_p99`

按场景维度统计：

- `scene=extract_premise`
- `scene=find_angles`
- `scene=joke_to_premise`
- `scene=rewrite`

建议维度组合：

- scene × model
- model × error_type
- scene × selected_model
- scene × fallback_count

---

## 6.2 日志规范

每次请求打印一条结构化日志：

```json
{
  "request_id": "req_xxx",
  "scene": "find_angles",
  "selected_model": "kimi-k2.6",
  "attempt_count": 2,
  "total_latency_ms": 38120,
  "attempts": [
    {"model": "glm-5", "status": "timeout", "latency_ms": 25001},
    {"model": "kimi-k2.6", "status": "success", "latency_ms": 13119}
  ]
}
```

每个 attempt 单独打印一条也可以，便于 Kibana / Loki / Datadog 检索。

---

## 6.3 建议的数据表

如果你希望长期看模型表现，建议新增一张明细表：

### 表：`llm_request_log`

字段建议：

- `id`
- `request_id`
- `scene`
- `selected_model`
- `attempt_count`
- `success`
- `total_latency_ms`
- `created_at`

### 表：`llm_attempt_log`

字段建议：

- `id`
- `request_id`
- `attempt_order`
- `model`
- `status`
- `error_type`
- `latency_ms`
- `created_at`

这样可以方便做日报、周报和自动调优。

---

## 7. 超时设计

## 7.1 分层超时

不要只设一个总超时，建议拆分：

### 单模型超时
- 默认：25 秒

### 首包超时（stream 场景）
- 默认：12 秒

### 总请求超时
- 默认：70 秒

说明：

- 单模型超时用于快速切换
- 首包超时避免流式接口一直无响应
- 总请求超时用于限制整条链路时长

### 推荐示例
4 个模型：

- 模型 1：25s
- 模型 2：20s
- 模型 3：15s
- 模型 4：10s
- 总时长上限：70s

也可以做“递减 timeout”，防止最后用户等太久。

---

## 8. 场景级模型策略建议

第一版先统一模型链即可。第二版建议按业务场景调优。

### 提炼前提
优先稳定、结构化能力强的模型

建议：
- `glm-5`
- `kimi-k2.6`
- `deepseek-v3.2`

### 找角度
更强调创意和发散

建议：
- `kimi-k2.6`
- `glm-5`
- `deepseek-v3.2`
- `minimax-m2.7`

### 梗写前提
需要理解 punchline 和反推结构

建议：
- `glm-5`
- `deepseek-v3.2`
- `kimi-k2.6`

### 改稿
需要长文本修改和结构保持

建议：
- `minimax-m2.7`
- `glm-5`
- `kimi-k2.6`

---

## 9. 对现有代码的改造点

## 9.1 后端

重点改造现有 routers 中直接调用单模型的位置：

- `backend/app/routers/extract_premise.py`
- `backend/app/routers/find_angles.py`
- `backend/app/routers/joke_to_premise.py`
- `backend/app/routers/rewrite*.py` 或相关改稿路由

原则：
- router 不再直接写死 DeepSeek
- 统一改为调用 `llm.gateway.generate(...)`

### 新调用方式

```python
result = await llm_gateway.generate(
    scene="find_angles",
    messages=messages,
    stream=False,
    request_id=request_id,
)
content = result.content
meta = result.meta
```

---

## 9.2 前端

重点改造：

- `frontend/src/app/write/PremiseTab.tsx`
- `frontend/src/app/write/AnglesTab.tsx`
- `frontend/src/app/write/JokeToPremiseTab.tsx`
- `frontend/src/app/write/WriteClient.tsx`
- `frontend/src/contexts/WorkflowSessionPanel.tsx`

改造内容：

- 接收返回的 `meta.selected_model`
- 接收 `meta.latency_ms`
- 在结果区显示模型名
- 在会话卡片中持久化模型名
- 错误态显示“已尝试 X 个模型”

---

## 10. 回滚与灰度方案

## 10.1 灰度开关

增加开关：

```env
LLM_GATEWAY_ENABLED=true
LLM_GATEWAY_SHADOW_MODE=false
```

### 模式说明

#### shadow mode
- 线上仍走旧逻辑
- 后台并发调用新网关
- 只记录结果，不返回给用户
- 用于先观察多模型耗时和成功率

#### enabled mode
- 真正切到新网关

---

## 10.2 回滚策略

如果新网关出问题：

- 一键关闭 `LLM_GATEWAY_ENABLED`
- 回退到原单模型逻辑
- 保留日志与数据，继续分析

---

## 11. 测试方案

## 11.1 单元测试

覆盖：

- 单模型成功
- 第 1 个模型超时，第 2 个成功
- 前 3 个失败，第 4 个成功
- 所有模型失败
- 非重试错误直接失败
- metadata 正确返回
- 日志正确记录

## 11.2 集成测试

覆盖：

- 提炼前提接口走新网关
- 找角度接口走新网关
- 梗写前提接口走新网关
- 改稿接口走新网关
- 前端能展示模型名称
- 结果卡片能保留模型信息

## 11.3 异常测试

模拟：

- TokenHub 429
- TokenHub 500
- 单模型超时
- 首包超时
- 返回空 choices
- 返回非预期 JSON

---

## 12. 验收标准

## 功能验收

1. 已支持 4 个模型通过 TokenHub 调用
2. 单模型超时后自动切换下一个模型
3. 成功结果页面能显示实际命中模型
4. 失败时能显示“已尝试多个模型”
5. 后端能记录每个模型耗时与失败次数

## 观测验收

6. 能按模型查看成功率
7. 能按模型查看 P95 耗时
8. 能按场景查看最终命中模型分布
9. 能统计 fallback 触发次数

## 稳定性验收

10. 单模型故障不会直接导致整条业务失败
11. 总体成功率高于原单模型方案
12. 总体超时率明显下降

---

## 13. 推荐实施顺序

### 第 1 阶段
- 新增 TokenHub client
- 新增 gateway
- 接入 4 个模型
- 打通一个场景（建议先接“梗写前提”）

### 第 2 阶段
- 接入全部创作场景
- 返回 meta.selected_model
- 页面展示模型名
- 接日志和 metrics

### 第 3 阶段
- 做场景级模型链
- 做 shadow mode
- 做自动调优和报表

---

## 14. 最终建议

第一版不要追求“最聪明的模型路由”，先把以下 3 件事做好：

1. **统一网关**
2. **自动回退**
3. **统一观测**

只要这三件事做扎实，当前“单个 DeepSeek 太慢且不稳”的核心问题就能明显缓解。后续再逐步做：
- 场景级模型优化
- 动态排序
- 熔断与自动降级
- 成本与效果联合优化
