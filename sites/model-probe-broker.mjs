/**
 * Manual live-model probe bridge over newline-delimited JSON stdin/stdout.
 * All address records come from tool-fixture; this process itself makes no model calls.
 * Commit messages publish a completed broker turn; errors emit a generic JSON object.
 */
// Manual live-model verification only; the address source is an isolated synthetic fixture.
import readline from 'node:readline';
import { makeBroker } from './tool-fixture.mjs';
const syntheticToolSession = makeBroker();
for await (const requestLine of readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
})) {
  try {
    const brokerRequest = JSON.parse(requestLine);
    if (brokerRequest.commit) {
      syntheticToolSession.commit(brokerRequest.commit);
      process.stdout.write('{}\n');
      continue;
    }
    const toolResponse = await syntheticToolSession.invoke(brokerRequest);
    process.stdout.write(JSON.stringify(toolResponse) + '\n');
  } catch {
    process.stdout.write(
      JSON.stringify({
        error: 'Synthetic broker failed',
      }) + '\n',
    );
  }
}
