"""InfiniSynapse Server API 客户端（参考实现，标准库零依赖）。

契约对齐 docs/reference/api-index.md 与 task-lifecycle.md。仅服务端使用——
不要把带 api_key 的代码下发到前端 / 客户端。

依赖：仅 Python 标准库（urllib）。生产可换成 httpx / requests。
"""
from __future__ import annotations

import json
import uuid
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Callable, Iterable, Optional

REGION_BASE = {"cn": "https://app.infinisynapse.cn", "com": "https://app.infinisynapse.com"}
REGION_ACCOUNT = {"cn": "https://api.infinisynapse.cn/api", "com": "https://api.infinisynapse.com/api"}
TOKEN_INVALID_CODES = (1101, 1105)


class InfiniSynapseError(Exception):
    def __init__(self, message: str, *, http_status: int | None = None, code: int | None = None,
                 token_invalid: bool = False, body: Any = None) -> None:
        super().__init__(message)
        self.http_status = http_status
        self.code = code
        self.token_invalid = token_invalid
        self.body = body


def parse_sse_data(raw: str) -> Any:
    """SSE data 尽量解析成 JSON；失败原样返回字符串（如 'ping'）。"""
    s = raw.strip()
    if s == "":
        return ""
    if s[0] not in "{[\"":
        return s
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        return s


class SseParser:
    """增量 SSE 解析器，纯函数式、无 I/O，便于离线测试。"""

    def __init__(self) -> None:
        self._buf = ""
        self._event = ""
        self._data: list[str] = []

    def push(self, chunk: str) -> list[dict[str, Any]]:
        self._buf += chunk.replace("\r\n", "\n").replace("\r", "\n")
        out: list[dict[str, Any]] = []
        while "\n" in self._buf:
            line, self._buf = self._buf.split("\n", 1)
            ev = self._consume_line(line)
            if ev:
                out.append(ev)
        return out

    def flush(self) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        if self._buf:
            ev = self._consume_line(self._buf)
            self._buf = ""
            if ev:
                out.append(ev)
        tail = self._dispatch()
        if tail:
            out.append(tail)
        return out

    def _consume_line(self, line: str) -> Optional[dict[str, Any]]:
        if line == "":
            return self._dispatch()
        if line.startswith(":"):
            return None
        field_name, _, value = line.partition(":")
        if value.startswith(" "):
            value = value[1:]
        if field_name == "event":
            self._event = value
        elif field_name == "data":
            self._data.append(value)
        return None

    def _dispatch(self) -> Optional[dict[str, Any]]:
        if self._event == "" and not self._data:
            return None
        ev = {"event": self._event or "message", "data": parse_sse_data("\n".join(self._data))}
        self._event = ""
        self._data = []
        return ev


@dataclass
class ClientConfig:
    api_key: str
    region: str = "cn"
    base_url: Optional[str] = None
    lang: str = "zh_CN"
    timeout: float = 30.0


class InfiniSynapseClient:
    def __init__(self, config: ClientConfig) -> None:
        if not config.api_key:
            raise ValueError("api_key is required")
        self.api_key = config.api_key
        self.base_url = (config.base_url or REGION_BASE[config.region]).rstrip("/")
        self.account_base_url = REGION_ACCOUNT[config.region]
        self.lang = config.lang
        self.timeout = config.timeout

    def _headers(self, extra: dict[str, str] | None = None) -> dict[str, str]:
        h = {"Authorization": f"Bearer {self.api_key}", "x-lang": self.lang}
        if extra:
            h.update(extra)
        return h

    def _url(self, path: str, query: dict[str, Any] | None = None) -> str:
        url = self.base_url + path
        if query:
            clean = {k: v for k, v in query.items() if v is not None}
            if clean:
                url += "?" + urllib.parse.urlencode(clean)
        return url

    def _request(self, method: str, path: str, *, query: dict | None = None, body: Any = None) -> Any:
        data = json.dumps(body).encode() if body is not None else None
        headers = self._headers({"Content-Type": "application/json"} if body is not None else None)
        req = urllib.request.Request(self._url(path, query), data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                raw = resp.read().decode()
                status = resp.status
        except urllib.error.HTTPError as e:
            raw = e.read().decode(errors="replace")
            status = e.code
        try:
            parsed = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            raise InfiniSynapseError(f"Non-JSON response from {path} (HTTP {status})", http_status=status, body=raw[:500])
        code = parsed.get("code") if isinstance(parsed, dict) else None
        if code in TOKEN_INVALID_CODES:
            raise InfiniSynapseError(f"API Key expired or invalid (code {code})", http_status=status, code=code, token_invalid=True, body=parsed)
        if status >= 400:
            msg = parsed.get("message") if isinstance(parsed, dict) else None
            raise InfiniSynapseError(msg or f"HTTP {status} from {path}", http_status=status, code=code, body=parsed)
        if isinstance(parsed, dict) and "data" in parsed and code is not None:
            return parsed["data"]
        return parsed

    # ---- AI 对话 ----
    def open_events(self, conn_id: str) -> Iterable[dict[str, Any]]:
        """建立 SSE 连接，逐个 yield 解析后的事件。必须先于 new_task 调用。"""
        req = urllib.request.Request(
            self._url("/api/ai/events", {"connId": conn_id}),
            headers=self._headers({"Accept": "text/event-stream"}),
            method="GET",
        )
        resp = urllib.request.urlopen(req, timeout=None)
        parser = SseParser()
        for raw in resp:
            for ev in parser.push(raw.decode(errors="replace")):
                yield ev

    def send_message(self, body: dict) -> Any:
        return self._request("POST", "/api/ai/message", body=body)

    def new_task(self, text: str, *, conn_id: str, task_id: str | None = None,
                 chat_settings: dict | None = None) -> Any:
        body = {"type": "newTask", "text": text, "connId": conn_id,
                "chatSettings": chat_settings or {"mode": "act"}}
        if task_id:
            body["taskId"] = task_id
        return self.send_message(body)

    def ask_response(self, task_id: str, *, conn_id: str | None = None, text: str | None = None) -> Any:
        body = {"type": "askResponse", "taskId": task_id, "askResponse": "messageResponse"}
        if conn_id:
            body["connId"] = conn_id
        if text is not None:
            body["text"] = text
        return self.send_message(body)

    def cancel_task(self, task_id: str) -> Any:
        return self._request("GET", "/api/ai_task/cancelTask", query={"taskId": task_id})

    def browser_session(self) -> Any:
        return self._request("GET", "/api/ai_browser/session")

    # ---- 任务产物 ----
    def get_ui_message_by_id(self, task_id: str) -> Any:
        return self._request("GET", "/api/ai_task/getUiMessageById", query={"id": task_id})

    def get_task_workspace(self, task_id: str) -> Any:
        return self._request("GET", f"/api/ai_task/getTaskWorkspace/{urllib.parse.quote(task_id)}")

    def preview_file(self, task_id: str, file_name: str) -> Any:
        return self._request("POST", "/api/ai_task/previewFile", body={"taskId": task_id, "fileName": file_name})

    def download_task_file(self, task_id: str, path: str, inline: bool = False) -> bytes:
        """二进制下载，不走 JSON 信封。"""
        query = {"path": path}
        if inline:
            query["inline"] = "1"
        req = urllib.request.Request(
            self._url(f"/api/tools/storage/downloadTaskFile/{urllib.parse.quote(task_id)}", query),
            headers=self._headers(), method="GET",
        )
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            return resp.read()


@dataclass
class RunTaskResult:
    task_id: str
    conn_id: str
    final_text: str = ""
    workspace: Any = None
    status: str = "completed"
    error: Optional[str] = None


def is_completion(message: dict) -> bool:
    return message.get("say") == "completion_result" or message.get("ask") == "completion_result"


def run_task(client: InfiniSynapseClient, text: str, *, task_id: str | None = None,
             on_text: Callable[[str], None] | None = None) -> RunTaskResult:
    """同步驱动一个完整长任务（教学版：单线程，先连 SSE 再发任务）。

    注意：urllib 单线程下，必须在消费 SSE 前把 new_task 发出去；这里用「先发后读」
    的简化策略——SSE 已建立连接（生成器首次 next 才真正连），生产建议用 httpx + 线程/asyncio。
    """
    conn_id = str(uuid.uuid4())
    task_id = task_id or str(uuid.uuid4())
    events = client.open_events(conn_id)  # 生成器：迭代时才真正读流
    # 先发任务，再读流（new_task 不依赖 SSE 已收到事件，只要求连接已建立）
    client.new_task(text, conn_id=conn_id, task_id=task_id)
    result = RunTaskResult(task_id=task_id, conn_id=conn_id)
    for ev in events:
        name = ev.get("event")
        data = ev.get("data")
        if name == "notification" and isinstance(data, dict) and data.get("type") == "error":
            result.status = "error"
            result.error = data.get("message") or data.get("title")
            break
        if name in ("message.add", "message.partial") and isinstance(data, dict):
            msg = data.get("message") or {}
            txt = msg.get("text")
            if txt:
                result.final_text += txt
                if on_text:
                    on_text(txt)
            if is_completion(msg):
                break
    if result.status == "completed":
        try:
            result.workspace = client.get_task_workspace(task_id)
        except InfiniSynapseError as e:
            result.error = str(e)
    return result
