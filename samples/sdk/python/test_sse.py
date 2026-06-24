"""离线 SSE 解析器单测，不触网。运行：python3 -m unittest test_sse.py"""
import unittest
from unittest.mock import patch

from infinisynapse_client import (
    ClientConfig, InfiniSynapseClient, InfiniSynapseError,
    SseParser, parse_sse_data, is_completion, TextAccumulator,
    next_backoff_seconds, select_missed_messages,
)


def collect(chunks):
    p = SseParser()
    out = []
    for c in chunks:
        out += p.push(c)
    out += p.flush()
    return out


class TestSse(unittest.TestCase):
    def test_single_event(self):
        evs = collect(['event: state.ready\ndata: {"taskId":"t1"}\n\n'])
        self.assertEqual(len(evs), 1)
        self.assertEqual(evs[0]["event"], "state.ready")
        self.assertEqual(evs[0]["data"], {"taskId": "t1"})

    def test_chunk_split_across_lines(self):
        evs = collect(["event: message.par", "tial\nda", 'ta: {"message":{"text":"hi"}}\n\n'])
        self.assertEqual(evs[0]["event"], "message.partial")
        self.assertEqual(evs[0]["data"], {"message": {"text": "hi"}})

    def test_multiple_events(self):
        evs = collect(['event: message.add\ndata: {"a":1}\n\nevent: message.add\ndata: {"a":2}\n\n'])
        self.assertEqual([e["data"] for e in evs], [{"a": 1}, {"a": 2}])

    def test_heartbeat_ping(self):
        evs = collect(["event: heartbeat\ndata: ping\n\n"])
        self.assertEqual(evs[0]["data"], "ping")

    def test_multiline_data(self):
        evs = collect(['event: notification\ndata: {"type":"error",\ndata: "message":"boom"}\n\n'])
        self.assertEqual(evs[0]["data"], {"type": "error", "message": "boom"})

    def test_crlf_and_comment(self):
        evs = collect([": comment\r\nevent: message.add\r\ndata: {\"x\":true}\r\n\r\n"])
        self.assertEqual(evs[0]["data"], {"x": True})

    def test_flush_tail(self):
        p = SseParser()
        self.assertEqual(p.push('event: message.add\ndata: {"end":1}\n'), [])
        tail = p.flush()
        self.assertEqual(tail[0]["data"], {"end": 1})

    def test_completion_detection(self):
        self.assertTrue(is_completion({"say": "completion_result"}))
        self.assertTrue(is_completion({"ask": "completion_result"}))
        self.assertFalse(is_completion({"text": "hi"}))

    def test_parse_non_json(self):
        self.assertEqual(parse_sse_data("ping"), "ping")
        self.assertEqual(parse_sse_data(""), "")
        self.assertEqual(parse_sse_data('{"a":1}'), {"a": 1})


class TestAccumulator(unittest.TestCase):
    def test_same_ts_overwrites(self):
        a = TextAccumulator()
        a.add("你", 100)
        a.add("你好", 100)
        a.add("你好世界", 100)
        self.assertEqual(a.text(), "你好世界")

    def test_different_ts_concat(self):
        a = TextAccumulator()
        a.add("第一段", 100)
        a.add("第二段", 200)
        self.assertEqual(a.text(), "第一段第二段")

    def test_mixed(self):
        a = TextAccumulator()
        for t, s in [(1, "A"), (1, "AB"), (2, "C"), (2, "CD")]:
            a.add(s, t)
        self.assertEqual(a.text(), "ABCD")

    def test_no_ts_appends(self):
        a = TextAccumulator()
        a.add("x", None)
        a.add("y", None)
        self.assertEqual(a.text(), "xy")


class TestReconnect(unittest.TestCase):
    def test_backoff_exponential_capped(self):
        self.assertEqual(next_backoff_seconds(0, 0.5, 10), 0.0)
        self.assertEqual(next_backoff_seconds(1, 0.5, 10), 0.5)
        self.assertEqual(next_backoff_seconds(2, 0.5, 10), 1.0)
        self.assertEqual(next_backoff_seconds(3, 0.5, 10), 2.0)
        self.assertEqual(next_backoff_seconds(10, 0.5, 10), 10)  # 封顶

    def test_select_missed_shapes_and_filter(self):
        msgs = [{"ts": 3, "text": "c"}, {"ts": 1, "text": "a"}, {"ts": 2, "text": "b"}]
        self.assertEqual([m["ts"] for m in select_missed_messages(msgs, set())], [1, 2, 3])
        self.assertEqual([m["ts"] for m in select_missed_messages({"messages": msgs}, {1})], [2, 3])
        self.assertEqual(select_missed_messages({"data": {"messages": msgs}}, {1, 2, 3}), [])
        self.assertEqual(select_missed_messages(None, set()), [])


class TestClientCancel(unittest.TestCase):
    def test_cancel_task_uses_message_endpoint_first(self):
        client = InfiniSynapseClient(ClientConfig(api_key="server-only-test-key", base_url="https://example.invalid"))
        calls = []

        def fake_request(method, path, *, query=None, body=None):
            calls.append({"method": method, "path": path, "query": query, "body": body})
            return {"success": True}

        client._request = fake_request

        client.cancel_task("task-1")

        self.assertEqual(calls, [{
            "method": "POST",
            "path": "/api/ai/message",
            "query": None,
            "body": {"type": "cancelTask", "taskId": "task-1"},
        }])

    def test_cancel_task_falls_back_when_message_endpoint_unavailable(self):
        client = InfiniSynapseClient(ClientConfig(api_key="server-only-test-key", base_url="https://example.invalid"))
        calls = []

        def fake_request(method, path, *, query=None, body=None):
            calls.append({"method": method, "path": path, "query": query, "body": body})
            if len(calls) == 1:
                raise InfiniSynapseError("not found", http_status=404)
            return {"success": True}

        client._request = fake_request

        client.cancel_task("task-1")

        self.assertEqual(calls[0]["path"], "/api/ai/message")
        self.assertEqual(calls[1], {
            "method": "GET",
            "path": "/api/ai_task/cancelTask",
            "query": {"taskId": "task-1"},
            "body": None,
        })

    def test_multipart_upload_rejects_business_error_envelope(self):
        client = InfiniSynapseClient(ClientConfig(api_key="server-only-test-key", base_url="https://example.invalid"))

        class FakeResponse:
            status = 200

            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                return False

            def read(self):
                return b'{"code":500,"message":"upload denied"}'

        with patch("urllib.request.urlopen", return_value=FakeResponse()):
            with self.assertRaises(InfiniSynapseError) as ctx:
                client.task_upload("task-1", b"x", "a.txt")

        self.assertEqual(ctx.exception.code, 500)
        self.assertEqual(str(ctx.exception), "upload denied")


if __name__ == "__main__":
    unittest.main()
