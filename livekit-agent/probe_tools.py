"""Explicit manual live LiveKit model probe; source and utterance are synthetic."""
import asyncio,json
from pathlib import Path
from address_agent import AddressToolAgent
async def main():
 root=Path(__file__).resolve().parents[1]
 process=await asyncio.create_subprocess_exec('node','sites/model-probe-broker.mjs',cwd=root,stdin=asyncio.subprocess.PIPE,stdout=asyncio.subprocess.PIPE)
 calls=[]
 async def invoke(payload):
  calls.append(payload['tool']);process.stdin.write((json.dumps(payload)+'\n').encode());await process.stdin.drain()
  value=json.loads(await process.stdout.readline())
  if value.get('error'):raise RuntimeError(value['error'])
  return value
 async def emit(event):pass
 agent=AddressToolAgent(invoke,emit)
 try:
  first=await agent.resolve(1,'50 Smith Avenue Fixture City 00000')
  assert first['result']['kind']=='choose' and first['context']['last_question']['field']=='confirm'
  process.stdin.write(b'{"commit":1}\n');await process.stdin.drain();await process.stdout.readline();agent.commit(first)
  second=await agent.resolve(2,'yes')
  assert second['result']['kind']=='confirmed' and second['result']['matches'][0]['values']==[300]
  expected=['apply_address_reply','find_address_candidates','choose_clarification']*2
  assert calls==expected
  print(json.dumps({'live_model_tool_calls':calls,'synthetic_confirmation':'passed'}))
 finally:
  await agent.aclose();process.terminate();await process.wait()
if __name__=='__main__':asyncio.run(main())
