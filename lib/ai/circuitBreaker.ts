// CLOUD-030: Circuit breaker for Anthropic API calls.
//
// Prevents cascading failures when the Anthropic API is degraded or down.
// After `threshold` consecutive failures, the circuit opens and immediately
// rejects new requests for `resetTimeoutMs`. After the timeout, a single
// "half-open" request is allowed through to probe recovery.
//
// NOTE: This is process-scoped (not shared across replicas). For multi-replica
// deployments, a Redis-backed circuit breaker would provide cluster-wide state.

export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private readonly threshold = 5,
    private readonly resetTimeoutMs = 60_000,
  ) {}

  /** Check whether a request should be allowed through. */
  allowRequest(): boolean {
    if (this.state === 'closed') return true;

    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = 'half-open';
        return true; // allow one probe request
      }
      return false;
    }

    // half-open: only one probe allowed (handled by transition above)
    return false;
  }

  onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }

  isOpen(): boolean {
    return this.state === 'open';
  }
}

export const anthropicCircuitBreaker = new CircuitBreaker(5, 60_000);
