/**
 * WebAuthn / Passkey 浏览器侧工具（F-9）。
 *
 * 服务端下发的 challenge / credentialId 为 base64url，浏览器 API 需要 ArrayBuffer，
 * 注册（navigator.credentials.create）与断言（.get）共用这一组转换。
 */

/** base64url → ArrayBuffer（缺省补齐 padding，兼容 -/_ 变体） */
export function b64urlToBuffer(value: string): ArrayBuffer {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  const base64 = (value + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes.buffer;
}

/** ArrayBuffer → base64url（去 padding） */
export function bufferToB64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let raw = "";
  bytes.forEach(byte => (raw += String.fromCharCode(byte)));
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 当前环境是否具备 WebAuthn 能力（非 HTTPS / 旧浏览器为 false） */
export function isPasskeySupported(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(window.PublicKeyCredential) &&
    Boolean(navigator.credentials?.create) &&
    Boolean(navigator.credentials?.get)
  );
}
