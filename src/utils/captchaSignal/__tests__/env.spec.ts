import { describe, expect, it } from "vitest";

import { collectCaptchaEnv } from "../env";

describe("captchaSignal/env", () => {
  it("采集环境包且不含敏感字段", () => {
    const env = collectCaptchaEnv();
    expect(env.v).toBe(1);
    expect(typeof env.timezone).toBe("string");
    expect(typeof env.language).toBe("string");
    expect(env.screen.width).toBeGreaterThanOrEqual(0);
    expect(env.screen.dpr).toBeGreaterThan(0);
    expect(typeof env.webdriver).toBe("boolean");
    expect(typeof env.reduced_motion).toBe("boolean");
    expect(env.fp).toMatch(/^[0-9a-f]{8}$/);
    expect(env.fp).toBe(collectCaptchaEnv().fp);
    const keys = Object.keys(env);
    expect(keys).not.toContain("password");
    expect(keys).not.toContain("cookie");
    expect(keys).not.toContain("username");
  });

  it("摘要字段为短十六进制或空串", () => {
    const env = collectCaptchaEnv();
    for (const value of [env.canvas, env.webgl]) {
      expect(value === "" || /^[0-9a-f]{8}$/.test(value)).toBe(true);
    }
  });
});
