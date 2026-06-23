"""离线 SSE 解析器单测，不触网。运行：python3 -m unittest test_sse.py"""
import unittest

from infinisynapse_client import SseParser, parse_sse_data, is_completion


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


if __name__ == "__main__":
    unittest.main()
