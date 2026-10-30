import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { computeFileHash, HASH_SLICE_BYTES } from "./contentHash";

/**
 * 内容指纹守护：算法必须与服务端 complete 期复算完全一致（整文件 SHA-256），
 * 否则所有分片上传都会在合并阶段被判「校验不匹配」。
 */
const sha256 = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");

const makeFile = (bytes: Uint8Array<ArrayBuffer>, name = "f.bin") =>
  new File([bytes], name, { type: "application/octet-stream" });

describe("computeFileHash", () => {
  it("空文件与短内容与标准 SHA-256 一致", async () => {
    expect(await computeFileHash(makeFile(new Uint8Array()))).toBe(sha256(""));
    expect(
      await computeFileHash(makeFile(new TextEncoder().encode("abc")))
    ).toBe(sha256("abc"));
  });

  it("跨多个摘要分片时仍等于整文件摘要（增量更新不丢边界字节）", async () => {
    const size = HASH_SLICE_BYTES * 2 + 12345;
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i++) bytes[i] = i % 251;
    const file = makeFile(bytes);

    expect(await computeFileHash(file)).toBe(sha256(bytes));
  });

  it("输出 64 位小写十六进制（服务端正则口径）", async () => {
    const hash = await computeFileHash(makeFile(new TextEncoder().encode("x")));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
