import { describe, expect, it } from "vitest";

import { AesDecrypted, AesEncrypted } from "./aes";

describe("aes 加解密", () => {
  it("同一密钥可往返解密", () => {
    const encrypted = AesEncrypted("secret-key", "Hello 世界 123");
    expect(encrypted).not.toContain("Hello");
    expect(AesDecrypted("secret-key", encrypted)).toBe("Hello 世界 123");
  });

  it("不同密钥无法解密出原文", () => {
    const encrypted = AesEncrypted("key-a", "payload");
    // 错误密钥下结果随随机盐波动：可能得到乱码，也可能因 Malformed UTF-8 直接抛错——两者都满足"解不出原文"
    let wrongKeyResult: string | undefined;
    try {
      wrongKeyResult = AesDecrypted("key-b", encrypted);
    } catch {
      return;
    }
    expect(wrongKeyResult).not.toBe("payload");
  });

  it("同一明文每次密文不同（随机盐）", () => {
    const a = AesEncrypted("key", "same");
    const b = AesEncrypted("key", "same");
    expect(a).not.toBe(b);
    expect(AesDecrypted("key", a)).toBe("same");
    expect(AesDecrypted("key", b)).toBe("same");
  });
});
