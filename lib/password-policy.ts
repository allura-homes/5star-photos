/**
 * Mirrors the Supabase Auth password policy (Dashboard -> Authentication ->
 * Sign In / Providers -> Password): minimum 6 characters, must contain at
 * least one letter and one digit. Keep this in sync with that setting so the
 * client never accepts a password GoTrue will reject.
 */
export const MIN_PASSWORD_LENGTH = 6

export const PASSWORD_HINT = `At least ${MIN_PASSWORD_LENGTH} characters with a letter and a number.`

export function getPasswordError(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters`
  if (!/[A-Za-z]/.test(password)) return "Include at least one letter"
  if (!/\d/.test(password)) return "Include at least one number"
  return null
}

export function isPasswordValid(password: string): boolean {
  return getPasswordError(password) === null
}
