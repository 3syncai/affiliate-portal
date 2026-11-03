const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const source = ts.transpileModule(
  fs.readFileSync(path.join(__dirname, "../hooks/useSSE.ts"), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;

// Drive transport events and timers without a browser, network, or real delays.
function mount(options = { affiliateCode: "ASM123" }) {
  const streams = [], states = [], effects = [], timers = new Map();
  const warnings = [], errors = [];
  let nextTimer = 0;
  class EventSource {
    constructor(url) { this.url = url; this.closed = false; streams.push(this); }
    close() { this.closed = true; }
  }
  const react = {
    useState(value) {
      const slot = states.length;
      states.push(value);
      return [value, next => { states[slot] = next; }];
    },
    useRef: current => ({ current }),
    useCallback: callback => callback,
    useEffect: callback => effects.push(callback),
  };
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    require: name => { assert.equal(name, "react"); return react; },
    EventSource,
    console: { log() {}, warn: (...args) => warnings.push(args), error: (...args) => errors.push(args) },
    setTimeout: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; },
    clearTimeout: id => timers.delete(id),
  });
  const hook = exports.useSSE(options);
  const cleanup = effects[0]();
  return { hook, cleanup, streams, states, timers, warnings, errors,
    retry() {
      const [id, timer] = timers.entries().next().value;
      timers.delete(id);
      timer.callback();
    },
  };
}

test("a dropped stream warns and retries once after five seconds", () => {
  const h = mount();
  const first = h.streams[0];
  first.onopen();
  assert.equal(h.states[0], true);
  first.onerror({});
  assert.equal(h.states[0], false);
  assert.equal(first.closed, true);
  assert.equal(h.errors.length, 0);
  assert.equal(h.warnings.length, 1);
  assert.equal(h.timers.size, 1);
  assert.equal([...h.timers.values()][0].delay, 5000);
  h.retry();
  assert.equal(h.streams.length, 2);
  h.streams[1].onopen();
  assert.equal(h.states[0], true);
  h.cleanup();
});

test("manual reconnect cancels a pending automatic retry", () => {
  const h = mount();
  h.streams[0].onerror({});
  h.hook.reconnect();
  assert.equal(h.streams.length, 2);
  assert.equal(h.timers.size, 0);
  h.cleanup();
});

test("obsolete stream events cannot affect the current connection", () => {
  const h = mount();
  const oldError = h.streams[0].onerror;
  const oldOpen = h.streams[0].onopen;
  const oldMessage = h.streams[0].onmessage;
  h.hook.reconnect();
  oldError({});
  oldOpen();
  oldMessage({ data: '{"type":"payment_received","message":"obsolete"}' });
  assert.equal(h.timers.size, 0);
  assert.equal(h.states[0], false);
  assert.equal(h.states[1], null);
  assert.equal(h.streams[1].closed, false);
  h.cleanup();
});

test("unmount cancels retries and ignores late events or reconnect calls", () => {
  const h = mount();
  const oldError = h.streams[0].onerror;
  oldError({});
  const queuedRetry = [...h.timers.values()][0].callback;
  h.cleanup();
  oldError({});
  queuedRetry();
  h.hook.reconnect();
  assert.equal(h.timers.size, 0);
  assert.equal(h.streams.length, 1);
});

test("messages still reach the original payment and general callbacks", () => {
  const payment = [], messages = [];
  const h = mount({ affiliateCode: "ASM +&123", onPaymentReceived: data => payment.push(data), onMessage: data => messages.push(data) });
  assert.equal(h.streams[0].url, "/api/sse/notifications?affiliate_code=ASM%20%2B%26123");
  h.streams[0].onmessage({ data: '{"type":"payment_received","message":"Paid","amount":100}' });
  assert.equal(payment[0].amount, 100);
  assert.equal(messages[0], payment[0]);
  assert.equal(h.states[1], payment[0]);
  h.cleanup();
});

test("empty affiliate codes do not open streams", () => {
  const h = mount({ affiliateCode: " " });
  assert.equal(h.streams.length, 0);
  assert.equal(h.timers.size, 0);
  h.cleanup();
});
