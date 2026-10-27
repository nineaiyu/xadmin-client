/**
 * verify 请求加签（与后端 captcha/tickets.py 同口径）。
 *
 * challenge 响应携带一次性会话密钥 ``ck`` 时，verify 必须附带：
 * ``gen_time``（秒）、一次性 ``nonce``、``sign``。
 * ``sign = hmac_sha256(ck, "{challenge_id}|{type}|{scene}|{answer_digest}|{gen_time}")``，
 * ``answer_digest = sha256(JSON.stringify(answer))``（紧凑 JSON，与后端
 * ``json.dumps(separators=(",", ":"))`` 一致）。
 *
 * 全部走 Web Crypto：不引入第三方依赖，也不新增 CSP 放宽。
 */

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), byte =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

/** 当前环境是否支持 Web Crypto（老浏览器 / 非安全上下文可能缺省） */
export function verifySignSupported(): boolean {
  return typeof crypto !== "undefined" && !!crypto.subtle;
}

/** 答案摘要：紧凑 JSON 的 SHA-256 十六进制串 */
export async function answerDigest(answer: unknown): Promise<string> {
  const payload = encoder.encode(JSON.stringify(answer));
  return toHex(await crypto.subtle.digest("SHA-256", payload));
}

/** HMAC-SHA256 十六进制签名 */
export async function hmacSha256Hex(
  key: string,
  message: string
): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return toHex(
    await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message))
  );
}

/** 一次性 nonce：16 字节随机数的十六进制串（32 字符） */
export function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

export type VerifySignInput = {
  ck: string;
  challengeId: string;
  type: string;
  scene: string;
  answer: unknown;
  genTime: number;
};

/** 按后端 canonical 口径计算 verify 签名 */
export async function buildVerifySign(input: VerifySignInput): Promise<string> {
  const digest = await answerDigest(input.answer);
  const canonical = [
    input.challengeId,
    input.type,
    input.scene,
    digest,
    String(input.genTime)
  ].join("|");
  return hmacSha256Hex(input.ck, canonical);
}
