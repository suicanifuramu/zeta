/**
 * An error whose message is already safe to show to the user (Japanese, written by us).
 * Anything else that reaches the UI is replaced by a generic text (see creator-util.errorMessage),
 * so raw HTTP paths or JSON bodies never appear on screen.
 */
export class UserError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UserError"
  }
}
