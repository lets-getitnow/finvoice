"""Synthetic model streams verify decorated-tool execution and failure boundaries."""
import asyncio,json,unittest
from livekit.agents import llm
from address_agent import AddressToolAgent
class SyntheticStream:
 """Deterministic model completion double with optional missing tool call."""
 def __init__(self,name,args,missing=False):
  """Capture synthetic inputs and initialize per-instance test state."""
  self.name=name;self.args=args;self.missing=missing
 async def collect(self):
  """Return a deterministic completion containing the requested tool call, or no calls for the failure case."""
  return llm.CollectedResponse(tool_calls=[] if self.missing else [llm.FunctionToolCall(name=self.name,arguments=json.dumps(self.args),call_id=self.name)])
 async def aclose(self):
  """Close the synthetic stream/model; track closure where the test asserts it."""
  pass
class SyntheticModel:
 """Record forced tool names and return deterministic tool arguments without network calls."""
 def __init__(self,missing=False):
  """Capture synthetic inputs and initialize per-instance test state."""
  self.names=[];self.missing=missing
 def chat(self,**kw):
  """Record the forced function name and return a synthetic completion stream."""
  name=kw['tool_choice']['function']['name'];self.names.append(name)
  return SyntheticStream(name,{'intent':'address'} if name=='apply_address_reply' else {'preferred_detail':'auto'} if name=='choose_clarification' else {},self.missing)
 async def aclose(self):
  """Close the synthetic stream/model; track closure where the test asserts it."""
  pass
class ToolChecks(unittest.IsolatedAsyncioTestCase):
 """Verify ordered decorated tool execution and rejection of missing model calls."""
 async def test_decorated_calls_execute_in_order_and_publish_events(self):
  """Verify decorated calls execute in order and publish events."""
  calls=[];events=[];model=SyntheticModel()
  async def invoke(payload):
   """Capture tool payloads and return only synthetic context/speech where required."""
   calls.append(payload);return {'tool':payload['tool'],'turn':payload['turn'],'context':{},'speech':'Synthetic question'}
  async def emit(event):
   """Append emitted lifecycle/transcript events to the isolated test observation list."""
   events.append(event)
  agent=AddressToolAgent(invoke,emit,model);await agent.resolve(7,'synthetic utterance')
  expected=['apply_address_reply','find_address_candidates','choose_clarification'];self.assertEqual(model.names,expected);self.assertEqual([c['tool'] for c in calls],expected)
  self.assertTrue(all(c['utterance']=='synthetic utterance' and c['turn']==7 for c in calls));self.assertEqual(len(events),6)
 async def test_missing_model_tool_call_fails_instead_of_fake_lookup(self):
  """Verify missing model tool call fails instead of fake lookup."""
  calls=[]
  async def invoke(payload):
   """Capture tool payloads and return only synthetic context/speech where required."""
   calls.append(payload)
  async def emit(event):
   """Append emitted lifecycle/transcript events to the isolated test observation list."""
   pass
  agent=AddressToolAgent(invoke,emit,SyntheticModel(missing=True))
  with self.assertRaisesRegex(ValueError,'Required LiveKit tool call missing'):await agent.resolve(1,'synthetic')
  self.assertEqual(calls,[])
if __name__=='__main__':unittest.main()
