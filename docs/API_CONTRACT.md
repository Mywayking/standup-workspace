# API Contract — Streaming Endpoints

All streaming SSE endpoints follow this contract.

## SSE Protocol

All streaming endpoints return **JSON data** for every event. The `data:` field always contains valid JSON.

### Event Types

| Event | data 格式 | Description |
|-------|-----------|-------------|
| `progress` | `{"type":"progress","phase":"...","message":"...","request_id":"..."}` | 阶段提示（非阻塞） |
| `token` | `{"type":"token","content":"汉字内容"}` | 流式 token（前端实时显示） |
| `done` | `{"type":"done","result":{...},"_meta":{...}}` | 最终结果 |
| `error` | `{"type":"error","error":"...","error_code":"...","retryable":true,"_meta":{...}}` | 错误 |
| `meta` | `{"type":"meta","selected_model":"...","provider":"...","attempt_count":1,"total_latency_ms":1234,"scene":"...","request_id":"..."}` | 观测数据 |

### _meta Object

All events include an optional `_meta` object with provider/latency info:

```json
{
  "_meta": {
    "provider": "deepseek",
    "model": "deepseek-chat",
    "latency_ms": 1200,
    "total_latency_ms": 3500,
    "attempt": 2,
    "mode": "stream"
  }
}
```

### Error Codes

| error_code | Description | retryable |
|------------|-------------|-----------|
| `TIMEOUT` | First chunk timeout | true |
| `RATE_LIMITED` | HTTP 429 | true |
| `HTTP_ERROR` | Non-retryable HTTP error | false |
| `PARSE_FAILED` | JSON parse failed | true |
| `NON_STREAM_FAILED` | Fallback non-stream also failed | true |
| `ALL_FAILED` | All models in chain failed | true |
| `TOTAL_TIMEOUT` | Total timeout exceeded | true |

---

## Endpoint Map

### New Unified Endpoints (preferred)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/write/premise/stream` | 提炼前提（流式） |
| POST | `/api/write/joke-to-premise/stream` | 梗写前提（流式） |
| POST | `/api/write/angles/stream` | 找角度（流式） |
| POST | `/api/write/rewrite/stream` | 改稿分析（流式） |

### Old Endpoints (deprecated, will be removed 2026-07-01)

| Old Path | Migrate To | Status |
|----------|-----------|--------|
| `POST /api/extract-premise/stream` | `/api/write/premise/stream` | Deprecated |
| `POST /api/joke-to-premise` | `/api/write/joke-to-premise/stream` | Deprecated |
| `POST /api/find-angles/stream` | `/api/write/angles/stream` | Deprecated |
| `POST /api/analyze/stream` | `/api/write/rewrite/stream` | Deprecated |

All deprecated endpoints return these response headers:
```
X-API-Deprecated: 1
X-API-Migrate-To: /api/write/premise/stream
X-API-Removal-Date: 2026-07-01
```

---

## Request/Response Examples

### POST /api/write/premise/stream

**Request:**
```json
{
  "text": "上班族的崩溃都是先保存再死机"
}
```

**Response (SSE):**
```
event: progress
data: {"type":"progress","phase":"analyzing","message":"正在分析中…","request_id":"wp_abc123"}

event: token
data: {"type":"token","content":"{"}

event: token
data: {"type":"token","content":"theme"}

... (streaming tokens)

event: done
data: {"type":"done","result":{"theme":"职场人的崩溃","attitude":"无奈","conflict":"系统比人先崩溃","premise_candidates":[...],"recommendation":{...},"scene_suggestions":[],"expansion_directions":[],"ending_direction":""},"_meta":{"provider":"deepseek","model":"deepseek-chat","latency_ms":1200,"total_latency_ms":3500,"attempt":1,"mode":"stream","scene":"write_premise"}}

event: meta
data: {"type":"meta","selected_model":"deepseek-chat","provider":"deepseek","request_id":"wp_abc123","attempt_count":1,"total_latency_ms":3500,"scene":"write_premise"}
```

### POST /api/write/joke-to-premise/stream

**Request:**
```json
{
  "text": "我不是自律，我只是穷得没有试错空间",
  "topic": "职场",
  "style": "自嘲"
}
```

**Response:** Same SSE format as above.

### Error Response

```
event: error
data: {"type":"error","error":"模型响应超时，请重试或稍后再试","error_code":"TIMEOUT","retryable":true,"_meta":{"provider":"deepseek","model":"deepseek-chat","latency_ms":12000,"total_latency_ms":12000,"attempt":1}}

event: meta
data: {"type":"meta","selected_model":"deepseek-chat","provider":"deepseek","request_id":"wp_abc123","attempt_count":1,"total_latency_ms":12000,"scene":"write_premise"}
```

---

## Deprecation Policy

1. Old endpoints return `X-API-Deprecated: 1` header
2. Old endpoints return `X-API-Migrate-To` header with replacement path
3. Old endpoints remain functional until **2026-07-01**
4. After removal date, old endpoints will return `410 Gone`

---

## Observability

Every LLM call logs these fields (see `backend/app/utils/logging.py`):

| Field | Source | Description |
|-------|--------|-------------|
| `request_id` | Per-request UUID | Trace ID |
| `scene` | `LLMRequest.scene` | Call context (e.g. `write_premise`) |
| `selected_model` | First successful model | Model that returned result |
| `provider` | Model prefix routing | `deepseek`, `minimax`, `glm`, `tokenhub` |
| `attempt_count` | Number of attempts | How many models tried |
| `latency_ms` | Per-attempt time | Time for single model |
| `total_latency_ms` | Total time | Time for entire chain |
| `error_code` | On failure | Error classification |

Frontend result cards display: `{selected_model} | {total_latency_ms/1000}s | fallback x{attempt_count-1}`
