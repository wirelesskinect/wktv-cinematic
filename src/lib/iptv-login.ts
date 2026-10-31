// Rules for the IPTV app login a customer chooses at checkout.
// Shared by the checkout page (instant feedback) and the server (the real check).

export const USERNAME_RULE = '4–16 lowercase letters or numbers, starting with a letter'
export const PASSWORD_RULE = '6–20 letters or numbers'

const RESERVED = new Set(['admin', 'administrator', 'root', 'test', 'support', 'wktv', 'reseller', 'demo', 'guest', 'user'])

export function normalizeUsername(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export function usernameError(username: string): string | null {
  if (!username) return 'Please choose a username for your TV app.'
  if (!/^[a-z][a-z0-9]{3,15}$/.test(username)) return `Username must be ${USERNAME_RULE}.`
  if (RESERVED.has(username)) return 'That username is reserved. Please pick another.'
  return null
}

export function passwordError(password: string, username = ''): string | null {
  if (!password) return 'Please choose a password for your TV app.'
  if (!/^[A-Za-z0-9]{6,20}$/.test(password)) return `Password must be ${PASSWORD_RULE} (no spaces or symbols).`
  if (password.toLowerCase() === username.toLowerCase()) return 'Password can’t be the same as your username.'
  if (/^(.)\1+$/.test(password) || /^(123456|1234567|12345678|123456789|password|qwerty)/i.test(password)) {
    return 'Please choose a less obvious password.'
  }
  return null
}
