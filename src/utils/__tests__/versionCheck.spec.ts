import { afterEach, describe, expect, it, vi } from "vitest";

import {
  checkRemoteVersion,
  fetchRemoteVersion,
  isRemoteNewer
} from "../versionCheck";

describe("isRemoteNewer", () => {
  it("同名版本不算更新", () => {
    expect(isRemoteNewer("4.2.5", "4.2.5")).toBe(false);
    expect(isRemoteNewer("v4.2.5", "4.2.5")).toBe(false);
  });

  it("按数值段比较（不按字符串）", () => {
    expect(isRemoteNewer("4.2.9", "4.2.10")).toBe(true);
    expect(isRemoteNewer("4.2.10", "4.2.9")).toBe(false);
    expect(isRemoteNewer("4.2.5", "5.0.0")).toBe(true);
  });

  it("预发布与构建元数据按语义化版本处理", () => {
    // 同核心版本：正式版比预发布版新
    expect(isRemoteNewer("4.2.5-beta.1", "4.2.5")).toBe(true);
    expect(isRemoteNewer("4.2.5", "4.2.5-beta.1")).toBe(false);
    // 构建元数据不影响比较
    expect(isRemoteNewer("4.2.5", "4.2.5+build.7")).toBe(false);
    // 缺段按 0 补齐
    expect(isRemoteNewer("4.2", "4.2.1")).toBe(true);
  });
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchRemoteVersion", () => {
  it("返回版本号（带时间戳绕过缓存）", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toContain("/version.json?t=");
      return jsonResponse({ version: "9.9.9" });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchRemoteVersion("/")).resolves.toBe("9.9.9");
  });

  it("状态码非 2xx 抛错", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not found", { status: 404 }))
    );

    await expect(fetchRemoteVersion("/")).rejects.toThrow("404");
  });

  it("缺 version 字段抛错", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ external: "" }))
    );

    await expect(fetchRemoteVersion("/")).rejects.toThrow("missing");
  });
});

describe("checkRemoteVersion", () => {
  it("返回远端版本与是否落后", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ version: "4.2.6" }))
    );

    await expect(checkRemoteVersion("4.2.5")).resolves.toEqual({
      version: "4.2.6",
      outdated: true
    });
  });
});
