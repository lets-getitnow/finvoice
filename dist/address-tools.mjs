/**
 * Browser-side transaction broker for server-owned address tools.
 * Each positive turn runs apply, find, choose in order; only commit publishes state.
 * Epoch cancellation prevents delayed responses from restoring obsolete conversation state.
 */
/**
 * Ordered tool protocol shared with the model worker; successful HTTP responses must echo tool
 * and turn.
 */
const ORDER=['apply_address_reply','find_address_candidates','choose_clarification'];
/**
 * Recognize short selections and detail replies that may reuse read-only preview history.
 */
const followup=value=>/^(?:yes|yeah|yep|correct|confirm|no|nope|(?:the |option |number )?(?:first|second|third|[123])(?: one| option)?|\d+[a-z]?)$/i.test(value.trim())||/^(?:the )?(?:zip|city|house number|unit)\b/i.test(value);
/**
 * Own committed history/context plus one provisional three-stage draft and a preview snapshot.
 */
export class AddressToolSession{
 /**
  * Inject an HTTP request adapter (fetch by default) and initialize empty state, turn high-water
  * mark and epoch.
  */
 constructor({request=(...args)=>fetch(...args)}={}){this.request=request;this.state={history:[],context:{}};this.preview=[];this.draft=null;this.highestTurn=0;this.epoch=0;}
 /**
  * Copy displayed recommendation history and record its candidate IDs/detail field for a later
  * explicit selection.
  */
 seedPreview(history,result){this.preview=[...history];this.previewContext=result?{...this.state.context,unknown_fields:[],last_question:{field:result.field||(result.matches?.length===1?'confirm':null),candidate_ids:(result.matches||[]).map(r=>r.id)}}:this.state.context;}
 /**
  * Invalidate in-flight work and discard the draft without deleting committed conversation
  * history.
  */
 cancel(){this.epoch++;this.draft=null;}
 /**
  * Return a copy of rejected record IDs for read-only search filtering.
  */
 get rejected(){return [...(this.state.context.rejected_ids||[])];}
 /**
  * Return a copy of committed utterance history so callers cannot append into broker state.
  */
 get history(){return [...this.state.history];}
 /**
  * Validate a positive monotonic turn and next phase, POST the draft to the server, then stage
  * echoed history/context. Throw on invalid order, HTTP failure, mismatched response or
  * cancellation; do not commit automatically.
  */
 async invoke(payload){
  if(!payload||!Number.isSafeInteger(payload.turn)||payload.turn<=0||!ORDER.includes(payload.tool))throw new Error('Invalid address tool call.');
  if(payload.tool===ORDER[0]){
   if(payload.turn<=this.highestTurn||typeof payload.utterance!=='string')throw new Error('Stale address turn.');
   this.highestTurn=payload.turn;
   this.draft={turn:payload.turn,stage:0,epoch:this.epoch,utterance:payload.utterance,history:followup(payload.utterance)&&this.preview.length?this.preview:this.state.history,context:followup(payload.utterance)&&this.preview.length?this.previewContext||this.state.context:this.state.context};
  }
  const draft=this.draft;
  if(!draft||draft.turn!==payload.turn||ORDER[draft.stage]!==payload.tool)throw new Error('Address tool called out of order.');
  const response=await this.request('/api/address/tools',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({tool:payload.tool,turn:payload.turn,utterance:draft.utterance,history:draft.history,context:draft.context,args:payload.arguments||{}})});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||'Address tool failed.');
  if(this.draft!==draft||draft.epoch!==this.epoch)throw new Error('Stale address result.');
  if(data.tool!==payload.tool||data.turn!==payload.turn)throw new Error('Address tool response mismatch.');
  if(data.history)draft.history=data.history;if(data.context)draft.context=data.context;
  draft.stage++;
  if(payload.tool===ORDER[2])draft.result=data;
  return data;
 }
 /**
  * Publish a fully completed matching draft, clear preview/draft and return its final response;
  * return null for incomplete or cancelled turns.
  */
 commit(turn){
  const draft=this.draft;if(!draft||draft.turn!==turn||draft.stage!==3||!draft.result)return null;
  this.state={history:[...draft.history],context:draft.context};this.preview=[];this.draft=null;return draft.result;
 }
}
