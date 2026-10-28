/**
 * DOM controller for the current hosted UI. Resolving and speech use an injected
 * VoiceSession; data and confirmation decisions remain server-owned. Text rendering
 * keeps source markup inert. Debounced previews never reveal a headline valuation.
 */
import { money } from './lookup.mjs';
import { VoiceSession } from './voice-session.mjs';
import { AddressToolSession } from './address-tools.mjs';

/**
 * Mount against index.html IDs and enable controls. voiceFactory permits isolated tests; the
 * default creates a LiveKit session. Installs page handlers and owns state until page exit.
 */
export function mountApp({
  voiceFactory = (voiceSessionOptions) => new VoiceSession(voiceSessionOptions),
} = {}) {
  /**
   * Resolve the required static DOM contract by ID.
   */
  const getElementById = (elementId) => document.getElementById(elementId);
  const addressToolSession = new AddressToolSession();
  /**
   * Track UI mode, preview generations and displayed/pending/selected card identity; generations
   * suppress stale HTTP previews.
   */
  let interfaceState = 'ready',
    previewHistory = [],
    previewRequestVersion = 0,
    previewDebounceTimer = null,
    displayedChoiceSnapshot = null,
    pendingPropertyId = null,
    selectedPropertyId = null;
  /**
   * Recognize short yes/no and ordinal replies that retain the displayed choices.
   */
  const isSelectionReply = (inputText) =>
    /^(?:yes|yeah|correct|confirm|no|nope|(?:the |option |number )?(?:first|second|third|[123])(?: one| option)?)$/i.test(
      inputText.trim(),
    );
  /**
   * Assign literal text and hide an element when that text is empty.
   */
  const showElementText = (elementId, inputText) => {
    getElementById(elementId).textContent = inputText;
    getElementById(elementId).hidden = !inputText;
  };
  /**
   * Synchronize app mode, action label, pressed state and recoverable status/error text.
   */
  function updateInterfaceState(nextState, message = '', isError = false) {
    interfaceState = nextState;
    getElementById('app').dataset.state = nextState;
    getElementById('talk-label').textContent =
      nextState === 'listening'
        ? 'Finish'
        : ['connecting', 'processing', 'speaking'].includes(nextState)
          ? 'Stop'
          : 'Speak';
    getElementById('talk').setAttribute('aria-pressed', String(nextState === 'listening'));
    getElementById('status').dataset.error = String(isError);
    showElementText('status', message);
  }
  /**
   * Create a text-only DOM element with an optional CSS class; never interpret source strings as
   * HTML.
   */
  const createTextElement = (tagName, textContent, className) => {
    const node = document.createElement(tagName);
    node.textContent = textContent;
    if (className) node.className = className;
    return node;
  };
  /**
   * Discard the card snapshot and selection identities, clear nodes and hide the choices panel.
   */
  function clearChoices() {
    displayedChoiceSnapshot = null;
    pendingPropertyId = null;
    selectedPropertyId = null;
    getElementById('choices').replaceChildren();
    getElementById('choices-panel').hidden = true;
  }
  /**
   * Render answer visibility, matched styling and label separately from the price output.
   */
  function renderAnswer(message, hasMatchedAddress = false) {
    getElementById('answer').hidden = !message;
    getElementById('answer').dataset.matched = String(hasMatchedAddress);
    getElementById('answer-label').hidden = !hasMatchedAddress;
    showElementText('result', message);
  }
  /**
   * Reflect pending and selected IDs in accessible button state, action text and loading
   * indicators.
   */
  function updateCards() {
    if (!displayedChoiceSnapshot) return;
    getElementById('choices').setAttribute('aria-busy', String(pendingPropertyId !== null));
    for (const card of displayedChoiceSnapshot.cards) {
      const isSelected = card.record.id === selectedPropertyId,
        isLoading = card.record.id === pendingPropertyId;
      card.button.setAttribute('aria-pressed', String(isSelected));
      card.button.dataset.loading = String(isLoading);
      card.action.textContent = isLoading ? 'Loading…' : isSelected ? 'Selected' : 'View price';
      card.arrow.textContent = isSelected ? '✓' : '→';
    }
  }
  /**
   * Render at most three safe-integer-ID candidates. Capture their history/result snapshot so
   * card clicks resolve an explicit ordinal through the same tool protocol; removed snapshots
   * cannot act.
   */
  function renderChoices(result, history) {
    const records = (result.matches || [])
      .slice(0, 3)
      .filter((propertyRecord) => Number.isSafeInteger(propertyRecord.id));
    if (!records.length) {
      clearChoices();
      return;
    }
    const choiceSnapshot = {
      result,
      history: [...history],
      cards: [],
    };
    displayedChoiceSnapshot = choiceSnapshot;
    pendingPropertyId = null;
    selectedPropertyId = null;
    getElementById('choices').replaceChildren();
    getElementById('choices-panel').hidden = false;
    getElementById('choices-heading').textContent = 'Possible matches';
    getElementById('choices-hint').textContent = [
      (result.prompt || '').replace(/You can also choose an address below.*$/, '').trim(),
      'Select an address to see its price.',
    ]
      .filter(Boolean)
      .join('\n');
    for (const [index, record] of records.entries()) {
      const card = createTextElement('button', '', 'address-choice');
      card.type = 'button';
      card.setAttribute(
        'aria-label',
        `Option ${index + 1}: ${[record.street, record.city, record.state, record.postal_code].filter(Boolean).join(', ')}. Show price.`,
      );
      const optionNumberElement = createTextElement('span', String(index + 1), 'choice-number');
      optionNumberElement.setAttribute('aria-hidden', 'true');
      const addressTextContainer = createTextElement('span', '', 'choice-copy');
      addressTextContainer.append(
        createTextElement('strong', record.street, 'choice-street'),
        createTextElement(
          'span',
          [record.city, record.state, record.postal_code].filter(Boolean).join(' · ') ||
            'Locality not provided',
          'choice-locality',
        ),
      );
      if (record.valuationConflict)
        addressTextContainer.append(
          createTextElement('span', 'Source values need review', 'choice-warning'),
        );
      const actionContainer = createTextElement('span', '', 'choice-action'),
        actionLabelElement = createTextElement('span', 'View price', 'choice-action-label'),
        arrowElement = createTextElement('span', '→', 'choice-arrow');
      arrowElement.setAttribute('aria-hidden', 'true');
      actionContainer.append(actionLabelElement, arrowElement);
      card.append(optionNumberElement, addressTextContainer, actionContainer);
      card.onclick = () => {
        if (displayedChoiceSnapshot !== choiceSnapshot) return;
        clearTimeout(previewDebounceTimer);
        ++previewRequestVersion;
        showElementText('price', '');
        renderAnswer('');
        pendingPropertyId = record.id;
        selectedPropertyId = null;
        updateCards();
        addressToolSession.seedPreview(choiceSnapshot.history, choiceSnapshot.result);
        getElementById('address').value = [
          record.street,
          record.city,
          record.state,
          record.postal_code,
        ]
          .filter(Boolean)
          .join(', ');
        updateInterfaceState('processing', 'Getting this property’s price…');
        void voiceSession.resolve(`option ${index + 1}`);
      };
      choiceSnapshot.cards.push({
        button: card,
        record,
        action: actionLabelElement,
        arrow: arrowElement,
      });
      getElementById('choices').append(card);
    }
    updateCards();
  }
  /**
   * Display a committed result. Only exact/confirmed records can show a single finite USD value;
   * preserve zero, disclose conflicts and never choose one conflicting price.
   */
  function renderAddressResult(result) {
    showElementText('price', '');
    pendingPropertyId = null;
    if (['confirmed', 'exact'].includes(result.kind)) {
      const record = result.matches[0],
        address = [record.street, record.city, record.state, record.postal_code]
          .filter(Boolean)
          .join(', ');
      const sourceValuations = Array.isArray(record.values)
        ? record.values.filter(Number.isFinite)
        : [];
      selectedPropertyId = record.id;
      updateCards();
      if (displayedChoiceSnapshot)
        getElementById('choices-hint').textContent = 'Choose another address to compare.';
      let message = address;
      if (sourceValuations.length === 1) showElementText('price', money(sourceValuations[0]));
      else
        message +=
          sourceValuations.length > 1
            ? `\nConflicting valuations: ${sourceValuations.map(money).join(', ')}. Check the source records.`
            : '\nNo valuation is available for this address.';
      renderAnswer(message, true);
    } else if (result.matches?.length) {
      renderAnswer('');
      renderChoices(result, addressToolSession.history);
    } else {
      clearChoices();
      renderAnswer(result.prompt || '');
    }
  }
  const voiceSession = voiceFactory({
    /**
     * Render interim/final text; invalidate pending previews. Interim transcripts debounce read-
     * only suggestions, while final text waits for the worker tool turn.
     */
    onTranscript(transcriptText, isFinalTranscript) {
      showElementText('price', '');
      if (!isSelectionReply(transcriptText)) {
        clearChoices();
        renderAnswer('');
      }
      showElementText('transcript', `You said: “${transcriptText}”`);
      getElementById('address').value = transcriptText;
      if (isFinalTranscript) {
        clearTimeout(previewDebounceTimer);
        ++previewRequestVersion;
        updateInterfaceState('processing', 'Understanding your address…');
      } else {
        clearTimeout(previewDebounceTimer);
        ++previewRequestVersion;
        previewDebounceTimer = setTimeout(() => void previewAddressSuggestions(), 300);
      }
    },
    /**
     * Delegate worker tool RPCs to the broker; the transport validates current agent and turn.
     */
    onToolCall: (payload) => addressToolSession.invoke(payload),
    /**
     * Show progress for each server tool phase without inventing a lookup result.
     */
    onToolEvent(event) {
      if (event.status === 'started')
        updateInterfaceState(
          'processing',
          {
            apply_address_reply: 'Understanding your reply…',
            find_address_candidates: 'Finding possible addresses…',
            choose_clarification: 'Choosing the next question…',
          }[event.name] || 'Working…',
        );
    },
    /**
     * Commit only a completed matching broker turn; return false to reject stale/incomplete
     * delivery.
     */
    onAddressResult(result, turnId) {
      const committedToolResponse = addressToolSession.commit(turnId);
      if (!committedToolResponse) return false;
      previewHistory = [];
      renderAddressResult(committedToolResponse.result);
      updateInterfaceState('processing', 'Preparing reply…');
      return true;
    },
    /**
     * Invalidate the broker draft whenever voice work is interrupted.
     */
    onCancel() {
      addressToolSession.cancel();
    },
    /**
     * Translate transport lifecycle state into the action/status UI.
     */
    onState(transportState) {
      updateInterfaceState(
        transportState,
        {
          connecting: 'Connecting…',
          listening: 'Listening…',
          processing: 'Working…',
          speaking: 'Speaking…',
          ready: '',
        }[transportState] || '',
      );
    },
    /**
     * Cancel pending tool state, release card loading state and expose sign-in recovery when
     * needed.
     */
    onError(message) {
      addressToolSession.cancel();
      pendingPropertyId = null;
      updateCards();
      updateInterfaceState('ready', message, true);
      getElementById('sign-in').hidden = !/sign in/i.test(message);
    },
  });
  /**
   * POST bounded history and rejected IDs to read-only search. Ignore obsolete responses and
   * failures, seed candidate history for follow-ups, and render choices without speaking or
   * showing a headline price.
   */
  async function previewAddressSuggestions() {
    const inputText = getElementById('address').value.trim();
    if (!inputText) return;
    const requestVersion = ++previewRequestVersion;
    const isFollowupReply =
      isSelectionReply(inputText) ||
      /^\d+[a-z]?$/.test(inputText) ||
      /^(?:the )?(?:zip|city|house number|unit)\b/i.test(inputText);
    const history = [
      ...(isFollowupReply && previewHistory.length ? previewHistory : addressToolSession.history),
      inputText,
    ];
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          history,
          rejected_ids: addressToolSession.rejected,
        }),
      });
      if (!response.ok) return;
      const result = await response.json();
      if (requestVersion !== previewRequestVersion) return;
      if (result.matches?.length && !isSelectionReply(inputText)) {
        previewHistory = history;
        addressToolSession.seedPreview(history, result);
      }
      showElementText('price', '');
      renderAnswer('');
      if (result.matches?.length) renderChoices(result, history);
      else {
        clearChoices();
        renderAnswer(result.prompt || '');
      }
    } catch {
      /* Read-only preview failure must not interrupt voice; committed tool failures are visible. */
    }
  }
  /**
   * Typing cancels active voice and tool work, clears obsolete prices/cards and debounces
   * recommendations by 250 ms.
   */
  getElementById('address').oninput = () => {
    addressToolSession.cancel();
    if (interfaceState !== 'ready') {
      voiceSession.stop();
      updateInterfaceState('ready');
    }
    showElementText('price', '');
    clearChoices();
    renderAnswer('');
    clearTimeout(previewDebounceTimer);
    ++previewRequestVersion;
    if (!getElementById('address').value.trim()) {
      showElementText('result', '');
      return;
    }
    previewDebounceTimer = setTimeout(() => void previewAddressSuggestions(), 250);
  };
  /**
   * Enter cancels preview work and resolves typed text through LiveKit; it does not bypass server
   * confirmation.
   */
  getElementById('search-form').onsubmit = (event) => {
    event.preventDefault();
    showElementText('price', '');
    clearChoices();
    renderAnswer('');
    clearTimeout(previewDebounceTimer);
    ++previewRequestVersion;
    const submittedAddress = getElementById('address').value.trim();
    if (submittedAddress) void voiceSession.resolve(submittedAddress);
  };
  /**
   * One control finishes capture, stops active work, or starts a fresh listen according to the UI
   * mode.
   */
  getElementById('talk').onclick = () => {
    if (interfaceState === 'listening') {
      void voiceSession.finish();
      return;
    }
    if (['connecting', 'processing', 'speaking'].includes(interfaceState)) {
      voiceSession.stop();
      pendingPropertyId = null;
      updateCards();
      updateInterfaceState('ready');
      return;
    }
    clearTimeout(previewDebounceTimer);
    ++previewRequestVersion;
    void voiceSession.listen();
  };
  /**
   * Release debounce timers and disconnect transport when the document leaves.
   */
  window.addEventListener('pagehide', () => {
    clearTimeout(previewDebounceTimer);
    void voiceSession.disconnect();
  });
  getElementById('talk').disabled = false;
  getElementById('submit').disabled = false;
}
