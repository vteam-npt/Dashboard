// This module must be bundled for Apps Script. It never trusts a key supplied by a client:
// callers fetch jwks from Google's fixed discovery endpoint and supply the configured client ID.
import { PKCS1_SHA256 } from 'micro-rsa-dsa-dh/rsa.js';

function decode(part) {
  if (typeof part !== 'string' || !/^[A-Za-z0-9_-]+$/.test(part) || part.length % 4 === 1) throw Error('Invalid token encoding');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let bits = 0, buffer = 0;
  const bytes = [];
  for (const ch of part) {
    buffer = (buffer << 6) | alphabet.indexOf(ch); bits += 6;
    if (bits >= 8) { bits -= 8; bytes.push((buffer >>> bits) & 255); buffer &= (1 << bits) - 1; }
  }
  if (bits && buffer) throw Error('Invalid token encoding');
  return new Uint8Array(bytes);
}
function json(part) {
  const bytes = decode(part);
  return JSON.parse(decodeURIComponent(Array.from(bytes, b => '%' + b.toString(16).padStart(2,'0')).join('')));
}
function integer(part) { return BigInt('0x' + Array.from(decode(part), b => b.toString(16).padStart(2,'0')).join('')); }

export function verifyGoogleIdToken(token, clientId, jwks, nowMs = Date.now()) {
  if (typeof token !== 'string' || token.length > 12000 || typeof clientId !== 'string' || !clientId) throw Error('Invalid token');
  const parts = token.split('.');
  if (parts.length !== 3) throw Error('Invalid token');
  const header = json(parts[0]), claims = json(parts[1]);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid || header.crit !== undefined) throw Error('Invalid token header');
  const key = Array.isArray(jwks?.keys) ? jwks.keys.find(k => k.kid === header.kid && k.kty === 'RSA' && (!k.alg || k.alg === 'RS256') && (!k.use || k.use === 'sig')) : null;
  if (!key) throw Error('Unknown signing key');
  const n = integer(key.n), e = integer(key.e);
  if (n.toString(2).length < 2048 || n.toString(2).length > 4096 || e !== BigInt(65537)) throw Error('Invalid signing key');
  const message = new Uint8Array(Array.from(parts[0] + '.' + parts[1], c => c.charCodeAt(0)));
  if (!PKCS1_SHA256.verify({n, e}, message, decode(parts[2]))) throw Error('Invalid signature');
  const now = Math.floor(nowMs / 1000);
  if (!['https://accounts.google.com','accounts.google.com'].includes(claims.iss) || claims.aud !== clientId ||
      !Number.isInteger(claims.exp) || claims.exp <= now || !Number.isInteger(claims.iat) || claims.iat > now + 60 ||
      typeof claims.sub !== 'string' || !claims.sub || typeof claims.email !== 'string' || claims.email_verified !== true ||
      (claims.azp !== undefined && claims.azp !== clientId)) throw Error('Invalid token claims');
  return {sub: claims.sub, email: claims.email.toLowerCase(), email_verified: true,
    hosted_domain: typeof claims.hd === 'string' ? claims.hd.toLowerCase() : ''};
}
