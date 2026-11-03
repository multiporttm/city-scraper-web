// Signs short-lived MapKit JS tokens so the browser can show Apple Maps.
// Needs a Maps ID and a MapKit JS private key from an Apple Developer account
// (developer.apple.com/account/resources/authkeys), set as Pages secrets (dashboard → Settings → Variables and Secrets):
//   APPLE_MAPKIT_TEAM_ID      10-character Team ID
//   APPLE_MAPKIT_KEY_ID       10-character Key ID of the MapKit JS key
//   APPLE_MAPKIT_PRIVATE_KEY  contents of the downloaded AuthKey_XXXXXXXXXX.p8 file
// The private key stays on the server; the browser only ever sees signed tokens.
import { getEnv } from '@/lib/env';

const TOKEN_LIFETIME_S = 30 * 60;
// Hand out a fresh token well before the old one expires
const REUSE_FOR_S = 20 * 60;

const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const encodeJson = (value: unknown) => base64url(new TextEncoder().encode(JSON.stringify(value)));

let keyPromise: Promise<CryptoKey> | null = null;

// A .p8 file is a PEM-wrapped PKCS #8 P-256 key. Secrets pasted on one line with literal "\n" work too.
function importKey(pem: string) {
  const body = pem
    .replace(/\\n/g, '\n')
    .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const der = Uint8Array.from(atob(body), (char) => char.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

const cache = new Map<string, { token: string; issuedAt: number }>();

export const mapkitConfigured = () =>
  !!(getEnv('APPLE_MAPKIT_TEAM_ID') && getEnv('APPLE_MAPKIT_KEY_ID') && getEnv('APPLE_MAPKIT_PRIVATE_KEY'));

// An ES256 JWT for MapKit JS, locked to the site's origin so it can't be reused elsewhere
export async function mapkitToken(origin: string) {
  const now = Math.floor(Date.now() / 1000);
  const cached = cache.get(origin);
  if (cached && now - cached.issuedAt < REUSE_FOR_S) return cached.token;

  keyPromise ??= importKey((getEnv('APPLE_MAPKIT_PRIVATE_KEY') ?? ''));
  const key = await keyPromise.catch((error: unknown) => {
    keyPromise = null;
    throw error;
  });
  const header = { alg: 'ES256', kid: getEnv('APPLE_MAPKIT_KEY_ID'), typ: 'JWT' };
  const payload = { iss: getEnv('APPLE_MAPKIT_TEAM_ID'), iat: now, exp: now + TOKEN_LIFETIME_S, origin };
  const unsigned = `${encodeJson(header)}.${encodeJson(payload)}`;
  // WebCrypto returns the raw r‖s signature, which is the form JWT's ES256 uses
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned));
  const token = `${unsigned}.${base64url(new Uint8Array(signature))}`;
  cache.set(origin, { token, issuedAt: now });
  return token;
}
