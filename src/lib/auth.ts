// Sesi admin: satu password dari environment, cookie bertanda tangan HMAC (tanpa database).
// Web Crypto dipakai supaya bisa dijalankan di proxy maupun di server action.

export const SESSION_COOKIE = "css_session";
export const SESSION_MAX_AGE_S = 8 * 60 * 60;

const encoder = new TextEncoder();

/** Kunci penanda tangan ikut memuat password: mengganti password otomatis membatalkan semua sesi lama. */
function signingKey(): string | null {
  const secret = process.env.AUTH_SECRET;
  const password = process.env.DASHBOARD_PASSWORD;
  if (!secret || secret.length < 32 || !password) return null;
  return `${secret}:${password}`;
}

/** False berarti login dimatikan dan semua halaman terkunci (gagal tertutup). */
export const authConfigured = () => signingKey() !== null;

async function hmacHex(key: string, data: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", encoder.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, encoder.encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function passwordMatches(input: string): Promise<boolean> {
  const key = signingKey();
  if (!key) return false;
  // Dibandingkan lewat HMAC supaya panjang dan isi password tidak bocor lewat waktu respons.
  const [a, b] = await Promise.all([hmacHex(key, `pw:${input}`), hmacHex(key, `pw:${process.env.DASHBOARD_PASSWORD}`)]);
  return safeEqual(a, b);
}

export async function createSessionToken(): Promise<string> {
  const key = signingKey();
  if (!key) throw new Error("Auth belum dikonfigurasi.");
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_S;
  return `${exp}.${await hmacHex(key, `session:${exp}`)}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  const key = signingKey();
  if (!key || !token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !/^\d{1,12}$/.test(exp)) return false;
  if (Number(exp) < Math.floor(Date.now() / 1000)) return false;
  return safeEqual(sig, await hmacHex(key, `session:${exp}`));
}
