/**
 * Typed error classes shared across API routes.
 * Keep this file focused — add only domain errors, not unrelated helpers.
 */

export class UserNotFoundError extends Error {
  constructor(
    public userId: string,
    public event: string
  ) {
    super(`user ${userId} not found while handling ${event}`);
    this.name = "UserNotFoundError";
  }
}
