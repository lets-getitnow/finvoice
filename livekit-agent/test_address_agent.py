"""Synthetic model streams verify decorated-tool execution and failure boundaries."""

import asyncio, json, unittest
from livekit.agents import llm
from address_agent import AddressToolAgent


class SyntheticStream:
    """Deterministic model completion double with optional missing tool call."""

    def __init__(self, tool_name, tool_arguments, missing=False):
        """Capture synthetic inputs and initialize per-instance test state."""
        self.name = tool_name
        self.args = tool_arguments
        self.missing = missing

    async def collect(self):
        """Return a deterministic completion containing the requested tool call, or no calls for the failure case."""
        return llm.CollectedResponse(
            tool_calls=(
                []
                if self.missing
                else [
                    llm.FunctionToolCall(
                        name=self.name,
                        arguments=json.dumps(self.args),
                        call_id=self.name,
                    )
                ]
            )
        )

    async def aclose(self):
        """Close the synthetic stream/model; track closure where the test asserts it."""
        pass


class SyntheticModel:
    """Record forced tool names and return deterministic tool arguments without network calls."""

    def __init__(self, missing=False):
        """Capture synthetic inputs and initialize per-instance test state."""
        self.names = []
        self.missing = missing

    def chat(self, **chat_options):
        """Record the forced function name and return a synthetic completion stream."""
        tool_name = chat_options["tool_choice"]["function"]["name"]
        self.names.append(tool_name)
        return SyntheticStream(
            tool_name,
            (
                {"intent": "address"}
                if tool_name == "apply_address_reply"
                else (
                    {"preferred_detail": "auto"}
                    if tool_name == "choose_clarification"
                    else {}
                )
            ),
            self.missing,
        )

    async def aclose(self):
        """Close the synthetic stream/model; track closure where the test asserts it."""
        pass


class ToolChecks(unittest.IsolatedAsyncioTestCase):
    """Verify ordered decorated tool execution and rejection of missing model calls."""

    async def test_decorated_calls_execute_in_order_and_publish_events(self):
        """Verify decorated calls execute in order and publish events."""
        captured_tool_calls = []
        captured_tool_events = []
        model = SyntheticModel()

        async def invoke(tool_call):
            """Capture tool payloads and return only synthetic context/speech where required."""
            captured_tool_calls.append(tool_call)
            return {
                "tool": tool_call["tool"],
                "turn": tool_call["turn"],
                "context": {},
                "speech": "Synthetic question",
            }

        async def emit(event):
            """Append emitted lifecycle/transcript events to the isolated test observation list."""
            captured_tool_events.append(event)

        address_tool_agent = AddressToolAgent(invoke, emit, model)
        await address_tool_agent.resolve(7, "synthetic utterance")
        expected_tool_sequence = [
            "apply_address_reply",
            "find_address_candidates",
            "choose_clarification",
        ]
        self.assertEqual(model.names, expected_tool_sequence)
        self.assertEqual(
            [c["tool"] for c in captured_tool_calls], expected_tool_sequence
        )
        self.assertTrue(
            all(
                c["utterance"] == "synthetic utterance" and c["turn"] == 7
                for c in captured_tool_calls
            )
        )
        self.assertEqual(len(captured_tool_events), 6)

    async def test_missing_model_tool_call_fails_instead_of_fake_lookup(self):
        """Verify missing model tool call fails instead of fake lookup."""
        captured_tool_calls = []

        async def invoke(tool_call):
            """Capture tool payloads and return only synthetic context/speech where required."""
            captured_tool_calls.append(tool_call)

        async def emit(event):
            """Append emitted lifecycle/transcript events to the isolated test observation list."""
            pass

        address_tool_agent = AddressToolAgent(
            invoke, emit, SyntheticModel(missing=True)
        )
        with self.assertRaisesRegex(ValueError, "Required LiveKit tool call missing"):
            await address_tool_agent.resolve(1, "synthetic")
        self.assertEqual(captured_tool_calls, [])


if __name__ == "__main__":
    unittest.main()
