import { describe, expect, it } from "vitest";

import { to } from "./async";

describe("to（await-to）", () => {
  it("成功时返回 [null, data]", async () => {
    const [err, data] = await to(Promise.resolve(42));
    expect(err).toBeNull();
    expect(data).toBe(42);
  });

  it("失败时返回 [error, undefined]", async () => {
    const [err, data] = await to(Promise.reject(new Error("boom")));
    expect((err as Error).message).toBe("boom");
    expect(data).toBeUndefined();
  });

  it("errorExt 合并进错误对象", async () => {
    const [err] = await to(Promise.reject(new Error("boom")), {
      context: "load"
    });
    expect((err as Error & { context?: string }).context).toBe("load");
  });
});
