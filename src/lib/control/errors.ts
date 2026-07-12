export class ControlOperationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number = 500,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ControlOperationError";
  }
}
