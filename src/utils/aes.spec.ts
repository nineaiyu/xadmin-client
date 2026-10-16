import { webcrypto } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AesDecrypted,
  AesDecryptedLegacy,
  AesDecryptedV2,
  AesEncrypted,
  AesEncryptedLegacy,
  AesEncryptedV2
} from "./aes";

beforeEach(() => {
  // jsdom 环境可能未提供 crypto.subtle，用 Node webcrypto 补齐（与浏览器同源实现）
  if (!globalThis.crypto?.subtle) {
    vi.stubGlobal("crypto", webcrypto);
  }
});

describe("aes v2 协议（WebCrypto PBKDF2+AES-GCM）", () => {
  it("加密产出 v2: 前缀且可往返解密", async () => {
    const encrypted = await AesEncryptedV2("secret-key", "Hello 世界 123");
    expect(encrypted.startsWith("v2:")).toBe(true);
    expect(encrypted).not.toContain("Hello");
    expect(await AesDecryptedV2("secret-key", encrypted)).toBe(
      "Hello 世界 123"
    );
  });

  it("同一明文每次密文不同（随机盐+随机 IV）", async () => {
    const a = await AesEncryptedV2("key", "same");
    const b = await AesEncryptedV2("key", "same");
    expect(a).not.toBe(b);
    expect(await AesDecryptedV2("key", a)).toBe("same");
    expect(await AesDecryptedV2("key", b)).toBe("same");
  });

  it("错误密钥 GCM 认证失败（拒绝解密）", async () => {
    const encrypted = await AesEncryptedV2("key-a", "payload");
    await expect(AesDecryptedV2("key-b", encrypted)).rejects.toThrow();
  });

  it("密文被篡改后解密失败", async () => {
    const encrypted = await AesEncryptedV2("key", "payload");
    const raw = encrypted.slice(3);
    const tampered = btoa(
      atob(raw)
        .split("")
        .map((c, i) => (i === 0 ? String.fromCharCode(c.charCodeAt(0) ^ 1) : c))
        .join("")
    );
    await expect(AesDecryptedV2("key", `v2:${tampered}`)).rejects.toThrow();
  });
});

describe("aes 默认入口（v2 优先 + 无 WebCrypto 回退）", () => {
  it("有 WebCrypto 时默认加密走 v2 格式，默认解密双格式自适应", async () => {
    const v2 = await AesEncrypted("key", "msg");
    expect(v2.startsWith("v2:")).toBe(true);
    expect(await AesDecrypted("key", v2)).toBe("msg");
  });

  it("无 WebCrypto 环境回退旧协议（无前缀）", async () => {
    vi.stubGlobal("crypto", undefined);
    const legacy = await AesEncrypted("key", "msg");
    expect(legacy.startsWith("v2:")).toBe(false);
    expect(await AesDecrypted("key", legacy)).toBe("msg");
  });

  it("默认解密兼容旧协议密文", async () => {
    const legacy = AesEncryptedLegacy("secret-key", "Hello 世界 123");
    expect(await AesDecrypted("secret-key", legacy)).toBe("Hello 世界 123");
  });
});

describe("aes 旧协议（OpenSSL Salted__ 兼容格式）", () => {
  it("同一密钥可往返解密", () => {
    const encrypted = AesEncryptedLegacy("secret-key", "Hello 世界 123");
    expect(encrypted).not.toContain("Hello");
    expect(AesDecryptedLegacy("secret-key", encrypted)).toBe("Hello 世界 123");
  });

  it("不同密钥无法解密出原文", () => {
    const encrypted = AesEncryptedLegacy("key-a", "payload");
    // 错误密钥下结果随随机盐波动：可能得到乱码，也可能因 Malformed UTF-8 直接抛错——两者都满足"解不出原文"
    let wrongKeyResult: string | undefined;
    try {
      wrongKeyResult = AesDecryptedLegacy("key-b", encrypted);
    } catch {
      return;
    }
    expect(wrongKeyResult).not.toBe("payload");
  });

  it("同一明文每次密文不同（随机盐）", () => {
    const a = AesEncryptedLegacy("key", "same");
    const b = AesEncryptedLegacy("key", "same");
    expect(a).not.toBe(b);
    expect(AesDecryptedLegacy("key", a)).toBe("same");
    expect(AesDecryptedLegacy("key", b)).toBe("same");
  });
});
