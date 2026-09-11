import { AES, Utf8 } from "crypto-es";

/**
 * 前端凭证加密协议（ADR-010 / ADR-011）：
 * - 旧协议：OpenSSL `Salted__` 兼容格式（EVP_BytesToKey(MD5) + AES-256-CBC），
 *   由 crypto-es 产出，无前缀，服务端 AESCipherV2 原生支持；
 * - v2 协议：浏览器 WebCrypto PBKDF2-HMAC-SHA256（100k 迭代）派生 AES-256-GCM
 *   密钥，密文以 `v2:` 前缀标记：`v2:` + base64(salt[16] | iv[12] | ct | tag[16])。
 *
 * 加密优先走 v2；非安全上下文（http 非 localhost，无 crypto.subtle）或 WebCrypto
 * 异常时自动回退旧协议。解密按 `v2:` 前缀双格式自适应，服务端同规则。
 */
const V2_PREFIX = "v2:";
const V2_PBKDF2_ITERATIONS = 100_000;
const V2_SALT_LENGTH = 16;
const V2_IV_LENGTH = 12;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function AesEncryptedLegacy(key: string, msg: string): string {
  return AES.encrypt(msg, key).toString();
}

export function AesDecryptedLegacy(
  key: string,
  encryptedMessage: string
): string {
  return AES.decrypt(encryptedMessage, key).toString(Utf8);
}

function hasWebCrypto(): boolean {
  return typeof crypto !== "undefined" && typeof crypto.subtle !== "undefined";
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach(b => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveV2Key(
  key: string,
  salt: Uint8Array<ArrayBuffer>
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key) as Uint8Array<ArrayBuffer>,
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: V2_PBKDF2_ITERATIONS,
      hash: "SHA-256"
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** v2 协议加密（强制 WebCrypto PBKDF2 + AES-GCM，供测试与显式场景使用） */
export async function AesEncryptedV2(
  key: string,
  msg: string
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(V2_SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(V2_IV_LENGTH));
  const aesKey = await deriveV2Key(key, salt);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encoder.encode(msg)
  );
  const payload = new Uint8Array(salt.length + iv.length + cipher.byteLength);
  payload.set(salt, 0);
  payload.set(iv, salt.length);
  payload.set(new Uint8Array(cipher), salt.length + iv.length);
  return V2_PREFIX + toBase64(payload);
}

/** v2 协议解密（GCM 认证失败时抛异常，由上层决定降级策略） */
export async function AesDecryptedV2(
  key: string,
  encryptedMessage: string
): Promise<string> {
  const base64Part = encryptedMessage.startsWith(V2_PREFIX)
    ? encryptedMessage.slice(V2_PREFIX.length)
    : encryptedMessage;
  const payload = fromBase64(base64Part);
  const salt = payload.slice(0, V2_SALT_LENGTH);
  const iv = payload.slice(V2_SALT_LENGTH, V2_SALT_LENGTH + V2_IV_LENGTH);
  const body = payload.slice(V2_SALT_LENGTH + V2_IV_LENGTH);
  const aesKey = await deriveV2Key(key, salt);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    body
  );
  return decoder.decode(plain);
}

/** 默认加密入口：优先 v2，WebCrypto 不可用或异常时回退旧协议 */
export async function AesEncrypted(key: string, msg: string): Promise<string> {
  if (hasWebCrypto()) {
    try {
      return await AesEncryptedV2(key, msg);
    } catch {
      // WebCrypto 异常（极少数环境）回退旧协议，服务端双格式自适应
    }
  }
  return AesEncryptedLegacy(key, msg);
}

/** 默认解密入口：按 `v2:` 前缀双格式自适应 */
export async function AesDecrypted(
  key: string,
  encryptedMessage: string
): Promise<string> {
  if (encryptedMessage.startsWith(V2_PREFIX)) {
    return AesDecryptedV2(key, encryptedMessage);
  }
  return AesDecryptedLegacy(key, encryptedMessage);
}
