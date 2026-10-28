/**
 * Browser-side transaction broker for server-owned address tools.
 * Each positive turn runs apply, find, choose in order; only commit publishes state.
 * Epoch cancellation prevents delayed responses from restoring obsolete conversation state.
 */
/**
 * Ordered tool protocol shared with the model worker; successful HTTP responses must echo tool
 * and turn.
 */
const ADDRESS_TOOL_SEQUENCE = [
  'apply_address_reply',
  'find_address_candidates',
  'choose_clarification',
];
/**
 * Recognize short selections and detail replies that may reuse read-only preview history.
 */
const isAddressFollowup = (utterance) =>
  /^(?:yes|yeah|yep|correct|confirm|no|nope|(?:the |option |number )?(?:first|second|third|[123])(?: one| option)?|\d+[a-z]?)$/i.test(
    utterance.trim(),
  ) || /^(?:the )?(?:zip|city|house number|unit)\b/i.test(utterance);
/**
 * Own committed history/context plus one provisional three-stage draft and a preview snapshot.
 */
export class AddressToolSession {
  /**
   * Inject an HTTP request adapter (fetch by default) and initialize empty state, turn high-water
   * mark and epoch.
   */
  constructor({ request = (...requestArguments) => fetch(...requestArguments) } = {}) {
    this.request = request;
    this.state = {
      history: [],
      context: {},
    };
    this.preview = [];
    this.draft = null;
    this.highestTurn = 0;
    this.epoch = 0;
  }
  /**
   * Copy displayed recommendation history and record its candidate IDs/detail field for a later
   * explicit selection.
   */
  seedPreview(history, result) {
    this.preview = [...history];
    this.previewContext = result
      ? {
          ...this.state.context,
          unknown_fields: [],
          last_question: {
            field: result.field || (result.matches?.length === 1 ? 'confirm' : null),
            candidate_ids: (result.matches || []).map((propertyRecord) => propertyRecord.id),
          },
        }
      : this.state.context;
  }
  /**
   * Invalidate in-flight work and discard the draft without deleting committed conversation
   * history.
   */
  cancel() {
    this.epoch++;
    this.draft = null;
  }
  /**
   * Return a copy of rejected record IDs for read-only search filtering.
   */
  get rejected() {
    return [...(this.state.context.rejected_ids || [])];
  }
  /**
   * Return a copy of committed utterance history so callers cannot append into broker state.
   */
  get history() {
    return [...this.state.history];
  }
  /**
   * Validate a positive monotonic turn and next phase, POST the draft to the server, then stage
   * echoed history/context. Throw on invalid order, HTTP failure, mismatched response or
   * cancellation; do not commit automatically.
   */
  async invoke(toolCall) {
    if (
      !toolCall ||
      !Number.isSafeInteger(toolCall.turn) ||
      toolCall.turn <= 0 ||
      !ADDRESS_TOOL_SEQUENCE.includes(toolCall.tool)
    )
      throw new Error('Invalid address tool call.');
    if (toolCall.tool === ADDRESS_TOOL_SEQUENCE[0]) {
      if (toolCall.turn <= this.highestTurn || typeof toolCall.utterance !== 'string')
        throw new Error('Stale address turn.');
      this.highestTurn = toolCall.turn;
      this.draft = {
        turn: toolCall.turn,
        stage: 0,
        epoch: this.epoch,
        utterance: toolCall.utterance,
        history:
          isAddressFollowup(toolCall.utterance) && this.preview.length
            ? this.preview
            : this.state.history,
        context:
          isAddressFollowup(toolCall.utterance) && this.preview.length
            ? this.previewContext || this.state.context
            : this.state.context,
      };
    }
    const pendingTurn = this.draft;
    if (
      !pendingTurn ||
      pendingTurn.turn !== toolCall.turn ||
      ADDRESS_TOOL_SEQUENCE[pendingTurn.stage] !== toolCall.tool
    )
      throw new Error('Address tool called out of order.');
    const response = await this.request('/api/address/tools', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tool: toolCall.tool,
        turn: toolCall.turn,
        utterance: pendingTurn.utterance,
        history: pendingTurn.history,
        context: pendingTurn.context,
        args: toolCall.arguments || {},
      }),
    });
    const toolResponse = await response.json();
    if (!response.ok) throw new Error(toolResponse.error || 'Address tool failed.');
    if (this.draft !== pendingTurn || pendingTurn.epoch !== this.epoch)
      throw new Error('Stale address result.');
    if (toolResponse.tool !== toolCall.tool || toolResponse.turn !== toolCall.turn)
      throw new Error('Address tool response mismatch.');
    if (toolResponse.history) pendingTurn.history = toolResponse.history;
    if (toolResponse.context) pendingTurn.context = toolResponse.context;
    pendingTurn.stage++;
    if (toolCall.tool === ADDRESS_TOOL_SEQUENCE[2]) pendingTurn.result = toolResponse;
    return toolResponse;
  }
  /**
   * Publish a fully completed matching draft, clear preview/draft and return its final response;
   * return null for incomplete or cancelled turns.
   */
  commit(turnId) {
    const pendingTurn = this.draft;
    if (
      !pendingTurn ||
      pendingTurn.turn !== turnId ||
      pendingTurn.stage !== 3 ||
      !pendingTurn.result
    )
      return null;
    this.state = {
      history: [...pendingTurn.history],
      context: pendingTurn.context,
    };
    this.preview = [];
    this.draft = null;
    return pendingTurn.result;
  }
}
