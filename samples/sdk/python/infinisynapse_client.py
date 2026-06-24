"""InfiniSynapse Server API 客户端（参考实现，标准库零依赖）。

契约对齐 docs/reference/api-index.md 与 task-lifecycle.md。仅服务端使用——
不要把带 api_key 的代码下发到前端 / 客户端。

依赖：仅 Python 标准库（urllib）。生产可换成 httpx / requests。
"""
from __future__ import annotations

import json
import socket
import time
import uuid
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Callable, Optional

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


class TextAccumulator:
    """按消息 ts 累积流式文本。

    InfiniSynapse 的 message.partial 同一 ts 是"覆盖"语义（流式快照逐步变长），
    所以同 ts 用最新文本覆盖，不同 ts 顺序拼接；无 ts 时退化为追加。
    这样既不会把累积快照重复拼接，也能拼出多段消息的全文。
    """

    def __init__(self) -> None:
        self._order: list[int] = []
        self._seg: dict[int, str] = {}
        self._fallback = ""

    def add(self, text: str, ts: Optional[int]) -> None:
        if not text:
            return
        if ts is None:
            self._fallback += text
            return
        if ts not in self._seg:
            self._order.append(ts)
        self._seg[ts] = text

    def text(self) -> str:
        return "".join(self._seg[t] for t in self._order) + self._fallback


@dataclass
class ClientConfig:
    api_key: str
    region: str = "cn"
    base_url: Optional[str] = None
    account_base_url: Optional[str] = None
    lang: str = "zh_CN"
    timeout: float = 30.0


class InfiniSynapseClient:
    def __init__(self, config: ClientConfig) -> None:
        if not config.api_key:
            raise ValueError("api_key is required")
        self.api_key = config.api_key
        self.base_url = (config.base_url or REGION_BASE[config.region]).rstrip("/")
        self.account_base_url = (config.account_base_url or REGION_ACCOUNT[config.region]).rstrip("/")
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
        # 文档：仅 code===200 为成功。出现其它业务码（HTTP 仍 200）视为错误，不吞掉。
        if code is not None and code != 200:
            msg = parsed.get("message") if isinstance(parsed, dict) else None
            raise InfiniSynapseError(msg or f"business error code {code}", http_status=status, code=code, body=parsed)
        if isinstance(parsed, dict) and "data" in parsed and code == 200:
            return parsed["data"]
        return parsed

    # ---- AI 对话：SSE ----
    def open_events_response(self, conn_id: str, read_timeout: float | None = None):
        """建立 SSE 连接并返回原始 HTTP 响应（**立即** urlopen，连接此刻建立）。

        必须先于 new_task 调用。read_timeout 给每次 socket 读设上限，便于上层做超时兜底。
        """
        req = urllib.request.Request(
            self._url("/api/ai/events", {"connId": conn_id}),
            headers=self._headers({"Accept": "text/event-stream"}),
            method="GET",
        )
        return urllib.request.urlopen(req, timeout=read_timeout)

    def iter_events(self, resp):
        """把已建立的 SSE 响应逐个解析成事件。"""
        parser = SseParser()
        for raw in resp:
            for ev in parser.push(raw.decode(errors="replace")):
                yield ev

    def open_events(self, conn_id: str):
        """便捷：建立连接（**调用即 urlopen，非惰性**）并返回事件迭代器。"""
        return self.iter_events(self.open_events_response(conn_id))

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
        try:
            return self.send_message({"type": "cancelTask", "taskId": task_id})
        except InfiniSynapseError as e:
            if e.http_status in (404, 405, 501):
                return self._request("GET", "/api/ai_task/cancelTask", query={"taskId": task_id})
            raise

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
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return resp.read()
        except urllib.error.HTTPError as e:
            raise InfiniSynapseError(f"download failed HTTP {e.code}", http_status=e.code)

    # ---- 上传（区分两类）----
    def _multipart(self, path: str, query: dict | None, filename: str, data: bytes,
                   content_type: str = "application/octet-stream") -> Any:
        boundary = "----infini" + uuid.uuid4().hex
        body = b"".join([
            f"--{boundary}\r\n".encode(),
            f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode(),
            f"Content-Type: {content_type}\r\n\r\n".encode(),
            data,
            f"\r\n--{boundary}--\r\n".encode(),
        ])
        headers = self._headers({"Content-Type": f"multipart/form-data; boundary={boundary}"})
        req = urllib.request.Request(self._url(path, query), data=body, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                raw = resp.read().decode()
                status = resp.status
        except urllib.error.HTTPError as e:
            raw, status = e.read().decode(errors="replace"), e.code
        try:
            parsed = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            raise InfiniSynapseError(f"Non-JSON upload response (HTTP {status})", http_status=status, body=raw[:500])
        code = parsed.get("code") if isinstance(parsed, dict) else None
        if code in TOKEN_INVALID_CODES:
            raise InfiniSynapseError(f"API Key expired or invalid (code {code})", http_status=status,
                                     code=code, token_invalid=True, body=parsed)
        if status >= 400:
            msg = parsed.get("message") if isinstance(parsed, dict) else None
            raise InfiniSynapseError(msg or f"upload failed HTTP {status}", http_status=status, code=code, body=parsed)
        if code is not None and code != 200:
            msg = parsed.get("message") if isinstance(parsed, dict) else None
            raise InfiniSynapseError(msg or f"upload business error code {code}", http_status=status,
                                     code=code, body=parsed)
        if isinstance(parsed, dict) and "data" in parsed and code == 200:
            return parsed["data"]
        return parsed

    def upload_to_sandbox(self, task_id: str, data: bytes, filename: str) -> Any:
        """被动：响应 Agent 的 upload_file_to_sandbox 请求。"""
        return self._multipart("/api/ai/upload", {"taskId": task_id}, filename, data)

    def task_upload(self, task_id: str, data: bytes, filename: str,
                    subdir: str = "upload_documents", naming: str = "original") -> Any:
        """主动：把资料归档到任务工作区固定子目录。"""
        return self._multipart(f"/api/tools/taskUpload/{urllib.parse.quote(task_id)}",
                               {"subdir": subdir, "naming": naming}, filename, data)


@dataclass
class RunTaskResult:
    task_id: str
    conn_id: str
    final_text: str = ""
    workspace: Any = None
    status: str = "completed"
    reconnects: int = 0
    error: Optional[str] = None


def is_completion(message: dict) -> bool:
    return message.get("say") == "completion_result" or message.get("ask") == "completion_result"


def next_backoff_seconds(attempt: int, base: float = 0.5, max_delay: float = 10.0) -> float:
    """指数退避（封顶），确定性，便于测试。"""
    if attempt <= 0:
        return 0.0
    return min(max_delay, base * (2 ** (attempt - 1)))


def select_missed_messages(ui: Any, seen_ts: set) -> list:
    """从 get_ui_message_by_id 各种形状里挑出 ts 尚未见过的消息，按 ts 升序（断点续传）。"""
    msgs = ui if isinstance(ui, list) else None
    if msgs is None and isinstance(ui, dict):
        msgs = ui.get("messages") or ui.get("uiMessages")
        if not isinstance(msgs, list) and isinstance(ui.get("data"), dict):
            msgs = ui["data"].get("messages")
    if not isinstance(msgs, list):
        return []
    out = [m for m in msgs if isinstance(m, dict) and isinstance(m.get("ts"), int) and m["ts"] not in seen_ts]
    return sorted(out, key=lambda m: m["ts"])


def run_task(client: InfiniSynapseClient, text: str, *, task_id: str | None = None,
             on_text: Callable[[str], None] | None = None,
             on_upload_request: "Callable[[dict], Optional[tuple[bytes, str]]] | None" = None,
             max_seconds: float = 600.0, read_timeout: float = 5.0,
             reconnect: bool = True, max_retries: int = 5,
             base_delay: float = 0.5, max_delay: float = 10.0,
             heartbeat_timeout: float = 30.0) -> RunTaskResult:
    """同步驱动一个完整长任务，内置 SSE 重连（退避 + 心跳 + getUiMessageById 断点续传）。

    严格"先连 SSE 再发 newTask"。reconnect=False 时流断开即判错。
    on_upload_request(message) -> (data, filename) | None 用于应答 upload_file_to_sandbox。
    """
    conn_id = str(uuid.uuid4())
    task_id = task_id or str(uuid.uuid4())
    result = RunTaskResult(task_id=task_id, conn_id=conn_id)
    acc = TextAccumulator()
    handled_asks: set = set()
    seen_ts: set = set()
    state = {"done": False, "task_sent": False, "attempt": 0}

    def handle_message(msg: dict) -> None:
        ts = msg.get("ts")
        if isinstance(ts, int):
            seen_ts.add(ts)
        txt = msg.get("text")
        if txt:
            acc.add(txt, ts if isinstance(ts, int) else None)
            if on_text:
                on_text(txt)
        if msg.get("type") == "ask" and msg.get("ask") == "upload_file_to_sandbox":
            if ts not in handled_asks:
                handled_asks.add(ts)
                _handle_upload(client, task_id, conn_id, msg, on_upload_request)
        if is_completion(msg):
            state["done"] = True

    overall_deadline = time.monotonic() + max_seconds
    while not state["done"] and time.monotonic() < overall_deadline:
        try:
            resp = client.open_events_response(conn_id, read_timeout=read_timeout)
        except Exception:
            resp = None
        if resp is not None:
            try:
                if not state["task_sent"]:
                    state["task_sent"] = True
                    try:
                        client.new_task(text, conn_id=conn_id, task_id=task_id)
                    except InfiniSynapseError as e:
                        result.status = "error"
                        result.error = f"newTask failed: {e}"
                        state["done"] = True
                        break
                parser = SseParser()
                last_event = time.monotonic()
                while not state["done"] and time.monotonic() < overall_deadline:
                    try:
                        raw = resp.readline()
                    except (socket.timeout, TimeoutError):
                        if time.monotonic() - last_event > heartbeat_timeout:
                            break  # 心跳超时 → 重连
                        continue
                    if not raw:
                        break  # 流结束
                    last_event = time.monotonic()
                    state["attempt"] = 0  # 有事件 → 清零失败计数
                    for ev in parser.push(raw.decode(errors="replace")):
                        name, data = ev.get("event"), ev.get("data")
                        if name == "notification" and isinstance(data, dict) and data.get("type") == "error":
                            result.status = "error"
                            result.error = data.get("message") or data.get("title")
                            state["done"] = True
                            break
                        if name in ("message.add", "message.partial", "message.update") and isinstance(data, dict):
                            handle_message(data.get("message") or {})
                            if state["done"]:
                                break
            except Exception as e:
                if not result.error:
                    result.error = str(e)
            finally:
                try:
                    resp.close()
                except Exception:
                    pass

        if state["done"]:
            break
        if not reconnect:
            result.status = "error"
            result.error = result.error or "SSE stream ended before completion (reconnect disabled)"
            break
        state["attempt"] += 1
        if state["attempt"] > max_retries:
            result.status = "error"
            result.error = result.error or f"SSE reconnect exhausted after {max_retries} retries"
            break
        result.reconnects += 1
        time.sleep(next_backoff_seconds(state["attempt"], base_delay, max_delay))
        # 断点续传：补回断线期间错过的消息
        try:
            ui = client.get_ui_message_by_id(task_id)
            for m in select_missed_messages(ui, seen_ts):
                handle_message(m)
                if state["done"]:
                    break
        except InfiniSynapseError:
            pass
    else:
        if not state["done"] and result.status == "completed":
            result.status = "error"
            result.error = result.error or f"timed out after {max_seconds}s"

    result.final_text = acc.text()
    if result.status == "completed":
        try:
            result.workspace = client.get_task_workspace(task_id)
        except InfiniSynapseError as e:
            result.error = str(e)
    return result


def _handle_upload(client, task_id, conn_id, msg, on_upload_request):
    try:
        file = on_upload_request(msg) if on_upload_request else None
        if file:
            data, filename = file
            uploaded = client.upload_to_sandbox(task_id, data, filename)
            client.ask_response(task_id, conn_id=conn_id, text=json.dumps(uploaded))
        else:
            client.ask_response(task_id, conn_id=conn_id, text="{}")
    except Exception:
        # 上传/回调失败不终止任务：回 {} 让 Agent 不卡住（与 TS 端一致）
        try:
            client.ask_response(task_id, conn_id=conn_id, text="{}")
        except Exception:
            pass
