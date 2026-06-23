"""最小示例：跑一个长任务并读产物。仅服务端运行。

    INFINISYNAPSE_API_KEY=<server-only key> python3 example_run_task.py
"""
import os
import sys

from infinisynapse_client import ClientConfig, InfiniSynapseClient, run_task


def main() -> int:
    api_key = os.environ.get("INFINISYNAPSE_API_KEY")
    if not api_key:
        print("set INFINISYNAPSE_API_KEY (server-side only)", file=sys.stderr)
        return 1

    client = InfiniSynapseClient(ClientConfig(api_key=api_key, region="cn"))
    result = run_task(
        client,
        "分析最近一个月的销售趋势，输出一份 Markdown 报告",
        on_text=lambda t: sys.stdout.write(t),
    )

    print(f"\n--- status: {result.status} ---")
    if result.error:
        print("error:", result.error)
    if result.workspace:
        for f in result.workspace.get("files", []):
            print("产物:", f.get("path") or f.get("name"))
    return 0 if result.status == "completed" else 2


if __name__ == "__main__":
    raise SystemExit(main())
