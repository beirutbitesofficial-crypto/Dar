/**
 * Domain errors carry a stable machine code. The API maps them to safe HTTP
 * responses; clients map the code to a translated message.
 */
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message ?? code);
    this.name = 'DomainError';
  }
}

export function invariant(condition: unknown, code: string, message?: string): asserts condition {
  if (!condition) throw new DomainError(code, message);
}
