import { createHash, createHmac, webcrypto } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  answerDigest,
  buildVerifySign,
  hmacSha256Hex,
  randomNonce,
  verifySignSupported
} from "../src/verifySign";

beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
});

const nodeDigest = (answer: unknown) =>
  createHash("sha256").update(JSON.stringify(answer)).digest("hex");
const nodeSign = (key: string, message: string) =>
  createHmac("sha256", key).update(message).digest("hex");

describe("verifySign（与后端 captcha/tickets.py 同口径）", () => {
  it("answer digest 为紧凑 JSON 的 sha256", async () => {
    await expect(answerDigest({ x: 123 })).resolves.toBe(
      nodeDigest({ x: 123 })
    );
    const points = {
      points: [
        { x: 10, y: 20 },
        { x: 30, y: 40 }
      ]
    };
    await expect(answerDigest(points)).resolves.toBe(nodeDigest(points));
  });

  it("HMAC-SHA256 与 node:crypto 交叉一致", async () => {
    await expect(hmacSha256Hex("ck-key", "hello|world")).resolves.toBe(
      nodeSign("ck-key", "hello|world")
    );
  });

  it("签名 canonical 与后端逐字节一致", async () => {
    const ck = "ck-session-key";
    const challengeId = "cid-1";
    const type = "slide";
    const scene = "login";
    const answer = { x: 123 };
    const genTime = 1793000000;
    const expected = nodeSign(
      ck,
      `${challengeId}|${type}|${scene}|${nodeDigest(answer)}|${genTime}`
    );
    await expect(
      buildVerifySign({ ck, challengeId, type, scene, answer, genTime })
    ).resolves.toBe(expected);
  });

  it("nonce 为 32 位十六进制且每次不同", () => {
    const first = randomNonce();
    const second = randomNonce();
    expect(first).toMatch(/^[0-9a-f]{32}$/);
    expect(second).not.toBe(first);
  });

  it("无 crypto.subtle 时回退纯 JS，签名仍与 node:crypto 一致", async () => {
    // http + 内网 IP（非安全上下文）没有 subtle：不得因此丧失加签能力
    vi.stubGlobal("crypto", undefined);
    expect(verifySignSupported()).toBe(true);
    await expect(answerDigest({ x: 123 })).resolves.toBe(
      nodeDigest({ x: 123 })
    );
    await expect(hmacSha256Hex("ck-key", "hello|world")).resolves.toBe(
      nodeSign("ck-key", "hello|world")
    );
    expect(randomNonce()).toMatch(/^[0-9a-f]{32}$/);
  });
});
