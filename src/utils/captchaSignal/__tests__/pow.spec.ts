import { webcrypto } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { leadingZeroBits, sha256Hex, solvePowFallback } from "../pow";

beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
});

describe("captchaSignal/pow", () => {
  it("sha256 与标准向量一致", async () => {
    await expect(sha256Hex("abc")).resolves.toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it("前导零比特计算", () => {
    expect(leadingZeroBits("f")).toBe(0);
    expect(leadingZeroBits("0f")).toBe(4);
    expect(leadingZeroBits("00ff")).toBe(8);
    expect(leadingZeroBits("0001")).toBe(15);
  });

  it("降级求解返回可验证 nonce", async () => {
    const challenge = "abc123";
    const bits = 5;
    const result = await solvePowFallback({
      algorithm: "sha256",
      challenge,
      difficulty_bits: bits,
      expire: 0
    });
    expect(result.degraded).toBe(true);
    const digest = await sha256Hex(`${challenge}${result.nonce}`);
    expect(leadingZeroBits(digest)).toBeGreaterThanOrEqual(bits);
  });
});
