import { describe, it, expect, beforeEach } from 'vitest';
import { CircuitBreaker } from '@/lib/ai/circuitBreaker';

// Tests run without Redis — exercises the in-memory fallback path.
// Redis-backed behavior shares the same logic; the only difference is
// where state is read/written.

describe('CircuitBreaker (in-memory fallback)', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker('test', 3, 500); // 3 failures, 500ms reset
  });

  // ------------------------------------------------------------------
  // Basic state transitions
  // ------------------------------------------------------------------

  it('starts in closed state — allows requests', async () => {
    expect(await cb.allowRequest()).toBe(true);
    expect(await cb.isOpen()).toBe(false);
  });

  it('stays closed after fewer failures than threshold', async () => {
    await cb.onFailure();
    await cb.onFailure();
    expect(await cb.allowRequest()).toBe(true);
    expect(await cb.isOpen()).toBe(false);
  });

  it('opens after reaching failure threshold', async () => {
    await cb.onFailure();
    await cb.onFailure();
    await cb.onFailure();
    expect(await cb.allowRequest()).toBe(false);
    expect(await cb.isOpen()).toBe(true);
  });

  it('rejects all requests while open', async () => {
    for (let i = 0; i < 3; i++) await cb.onFailure();
    expect(await cb.allowRequest()).toBe(false);
    expect(await cb.allowRequest()).toBe(false);
    expect(await cb.allowRequest()).toBe(false);
  });

  // ------------------------------------------------------------------
  // Reset and recovery
  // ------------------------------------------------------------------

  it('resets to closed on success', async () => {
    await cb.onFailure();
    await cb.onFailure();
    await cb.onSuccess();
    expect(await cb.allowRequest()).toBe(true);
    expect(await cb.isOpen()).toBe(false);
  });

  it('transitions to half-open after reset timeout and allows one probe', async () => {
    for (let i = 0; i < 3; i++) await cb.onFailure();
    expect(await cb.allowRequest()).toBe(false);

    // Wait for reset timeout
    await new Promise((r) => setTimeout(r, 600));

    // First call after timeout: half-open → allows one probe
    expect(await cb.allowRequest()).toBe(true);
    // Second call while still half-open: blocked
    expect(await cb.allowRequest()).toBe(false);
  });

  it('closes circuit when probe succeeds', async () => {
    for (let i = 0; i < 3; i++) await cb.onFailure();
    await new Promise((r) => setTimeout(r, 600));

    // Probe allowed
    expect(await cb.allowRequest()).toBe(true);

    // Probe succeeds → circuit closes
    await cb.onSuccess();
    expect(await cb.allowRequest()).toBe(true);
    expect(await cb.isOpen()).toBe(false);
  });

  it('re-opens circuit when probe fails', async () => {
    for (let i = 0; i < 3; i++) await cb.onFailure();
    await new Promise((r) => setTimeout(r, 600));

    // Probe allowed (half-open)
    expect(await cb.allowRequest()).toBe(true);

    // Probe fails → circuit re-opens
    await cb.onFailure();
    expect(await cb.allowRequest()).toBe(false);
    expect(await cb.isOpen()).toBe(true);
  });

  // ------------------------------------------------------------------
  // Failure counter reset
  // ------------------------------------------------------------------

  it('resets failure counter on success even before threshold', async () => {
    await cb.onFailure();
    await cb.onFailure();
    await cb.onSuccess(); // resets counter to 0
    await cb.onFailure(); // 1 failure — below threshold
    expect(await cb.allowRequest()).toBe(true);
  });

  it('requires threshold consecutive failures after a success reset', async () => {
    await cb.onFailure();
    await cb.onFailure();
    await cb.onSuccess();
    // Need 3 more failures to open again
    await cb.onFailure();
    await cb.onFailure();
    expect(await cb.allowRequest()).toBe(true); // still below threshold
    await cb.onFailure();
    expect(await cb.allowRequest()).toBe(false); // now open
  });
});
