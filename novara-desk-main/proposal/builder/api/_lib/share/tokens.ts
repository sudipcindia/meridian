import { randomBytes } from 'node:crypto'

/**
 * Generates a cryptographically random, unguessable opaque token — never a
 * JWT. This is deliberate: revocation of an opaque, DB-stored token is a
 * trivial column check (revoked_at), whereas a JWT would need a separate
 * deny-list to support revocation at all. Since the brief asks this
 * architecture to support future expiry/revocation, the opaque approach
 * gets that for free.
 */
export function generateShareToken(): string {
  return randomBytes(32).toString('base64url')
}
