// CLOUD-030: Circuit breaker for Anthropic API calls.
//
// Prevents cascading failures when the Anthropic API is degraded or down.
// After `threshold` consecutive failures, the circuit opens and immediately
// rejects new requests for `resetTimeoutMs`. After the timeout, a single
// "half-open" request is allowed through to probe recovery.
//
// NOTE: This is process-scoped (not shared across replicas). For multi-replica
// deployments, a Redis-backed circuit breaker would provide cluster-wide state.

// WARNING: This circuit breaker is process-scoped. In multi-replica deployments
// (e.g., Railway with 2+ instances), each replica has independent state.
// Replica A may open its circuit while Replica B continues sending requests.
// For cluster-wide circuit breaking, consider a Redis-backed implementation.

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

    // half-open: one probe request was already allowed during the open→half-open
    // transition above. Block all subsequent requests until onSuccess() (closes
    // the circuit) or onFailure() (re-opens it) resolves the state.
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
