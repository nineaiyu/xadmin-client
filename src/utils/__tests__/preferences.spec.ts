import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { resolveBootLocale } from "../preferences";

describe("resolveBootLocale", () => {
  it("本地存储有值时以存储为准（与 useLayout.initStorage 优先级同源）", () => {
    expect(resolveBootLocale("en", "zh")).toBe("en");
    expect(resolveBootLocale("zh", "en")).toBe("zh");
  });

  it("存储为空时回落 platform-config 的 Locale", () => {
    expect(resolveBootLocale(undefined, "en")).toBe("en");
    expect(resolveBootLocale("", "en")).toBe("en");
  });

  it("两者皆空时回落 zh", () => {
    expect(resolveBootLocale()).toBe("zh");
    expect(resolveBootLocale(undefined, undefined)).toBe("zh");
    expect(resolveBootLocale("", "")).toBe("zh");
  });
});

/**
 * 首屏语言装配顺序守护：服务端站点配置的 Locale 会覆写本地语言存储，
 * 「实际生效语言」必须在同步之后再判定，并按它预加载语料且早于挂载——
 * 否则布局 / 登录页恢复语言时 en 语料未就绪，首帧报 key not found 并回退中文。
 */
describe("首屏语言装配顺序", () => {
  it("按站点配置同步后的实际语言预加载语料，且早于挂载", () => {
    const source = readFileSync(resolve(__dirname, "../../main.ts"), "utf8");
    const syncAt = source.indexOf("getSiteConfig()");
    const resolveAt = source.indexOf("resolveBootLocale(");
    const ensureAt = source.indexOf("ensureLocale(appliedLocale)");
    const mountAt = source.indexOf('app.mount("#app")');

    expect(syncAt).toBeGreaterThan(-1);
    expect(resolveAt).toBeGreaterThan(syncAt);
    expect(ensureAt).toBeGreaterThan(resolveAt);
    expect(mountAt).toBeGreaterThan(ensureAt);
  });
});
