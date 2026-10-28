"""Explicit manual live LiveKit model probe; source and utterance are synthetic."""

import asyncio, json
from pathlib import Path
from address_agent import AddressToolAgent


async def main():
    """Run an explicitly manual live-model probe against a child synthetic Node broker; verify fuzzy clarification then yes confirmation and close model/process in finally."""
    repository_root = Path(__file__).resolve().parents[1]
    broker_process = await asyncio.create_subprocess_exec(
        "node",
        "sites/model-probe-broker.mjs",
        cwd=repository_root,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
    )
    invoked_tool_names = []

    async def invoke(tool_call):
        """Write one newline-delimited tool payload to the synthetic broker and decode one response; raise on broker errors."""
        invoked_tool_names.append(tool_call["tool"])
        broker_process.stdin.write((json.dumps(tool_call) + "\n").encode())
        await broker_process.stdin.drain()
        tool_response = json.loads(await broker_process.stdout.readline())
        if tool_response.get("error"):
            raise RuntimeError(tool_response["error"])
        return tool_response

    async def emit(event):
        """Ignore lifecycle events during this manual call-order probe; no transcript is logged."""
        pass

    address_tool_agent = AddressToolAgent(invoke, emit)
    try:
        clarification_response = await address_tool_agent.resolve(
            1, "50 Smyth Avenue Fixture City 00000"
        )
        assert (
            clarification_response["result"]["kind"] == "choose"
            and clarification_response["context"]["last_question"]["field"] == "confirm"
        )
        broker_process.stdin.write(b'{"commit":1}\n')
        await broker_process.stdin.drain()
        await broker_process.stdout.readline()
        address_tool_agent.commit(clarification_response)
        confirmed_response = await address_tool_agent.resolve(2, "yes")
        assert confirmed_response["result"][
            "kind"
        ] == "confirmed" and confirmed_response["result"]["matches"][0]["values"] == [
            300
        ]
        expected_tool_sequence = [
            "apply_address_reply",
            "find_address_candidates",
            "choose_clarification",
        ] * 2
        assert invoked_tool_names == expected_tool_sequence
        print(
            json.dumps(
                {
                    "live_model_tool_calls": invoked_tool_names,
                    "synthetic_confirmation": "passed",
                }
            )
        )
    finally:
        await address_tool_agent.aclose()
        broker_process.terminate()
        await broker_process.wait()


if __name__ == "__main__":
    asyncio.run(main())
