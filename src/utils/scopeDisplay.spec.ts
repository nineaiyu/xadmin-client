import { describe, expect, it, vi } from "vitest";
import {
  buildScopeIndex,
  fetchScopeCatalog,
  formatScopeEntry,
  formatScopeLines,
  invalidateScopeCatalog,
  type ScopeGroup
} from "./scopeDisplay";

const GROUP: ScopeGroup = {
  key: "user",
  title: "menus.userManagement",
  options: [
    {
      value: "GET ^/api/system/user/?$",
      method: "GET",
      path: "/api/system/user",
      label: "获取用户的列表",
      code: "list:SystemUser"
    },
    {
      value: "GET ^/api/system/user/[^/]+/?$",
      method: "GET",
      path: "/api/system/user/{pk}",
      label: "获取用户详情",
      code: "retrieve:SystemUser"
    }
  ]
};

describe("buildScopeIndex", () => {
  it("按条目值建索引，覆盖多分组", () => {
    const index = buildScopeIndex([
      GROUP,
      {
        key: "root",
        title: "",
        options: [
          {
            value: "POST ^/api/system/role/?$",
            method: "POST",
            path: "/api/system/role",
            label: "添加角色",
            code: "create:SystemRole"
          }
        ]
      }
    ]);
    expect(index.size).toBe(3);
    expect(index.get("GET ^/api/system/user/?$")?.path).toBe(
      "/api/system/user"
    );
    expect(index.get("POST ^/api/system/role/?$")?.method).toBe("POST");
  });

  it("无目录/空分组时返回空索引，不抛错", () => {
    expect(buildScopeIndex().size).toBe(0);
    expect(buildScopeIndex([{ key: "k", title: "", options: [] }]).size).toBe(
      0
    );
  });
});

describe("formatScopeEntry", () => {
  const index = buildScopeIndex([GROUP]);

  it("命中目录显示「METHOD 可读路径」", () => {
    expect(formatScopeEntry("GET ^/api/system/user/[^/]+/?$", index)).toBe(
      "GET /api/system/user/{pk}"
    );
  });

  it("未命中（自定义条目/白名单接口）原样返回", () => {
    expect(formatScopeEntry("/api/system/personal-access-tokens", index)).toBe(
      "/api/system/personal-access-tokens"
    );
    expect(formatScopeEntry("GET ^/api/system/user/?$")).toBe(
      "GET ^/api/system/user/?$"
    );
  });
});

describe("formatScopeLines", () => {
  it("一行一条，混合命中与未命中条目", () => {
    const index = buildScopeIndex([GROUP]);
    expect(
      formatScopeLines(
        ["GET ^/api/system/user/?$", "/api/system/userinfo"],
        index
      )
    ).toBe("GET /api/system/user\n/api/system/userinfo");
  });

  it("空清单返回空串", () => {
    expect(formatScopeLines()).toBe("");
    expect(formatScopeLines([])).toBe("");
  });
});

describe("fetchScopeCatalog", () => {
  it("同键命中缓存只发一次请求", async () => {
    const fetcher = vi.fn(() => Promise.resolve({ code: 1000, data: {} }));
    await fetchScopeCatalog("test-hit", fetcher);
    await fetchScopeCatalog("test-hit", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    invalidateScopeCatalog("test-hit");
  });

  it("业务失败不写缓存，下次调用可重试", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ code: 1001, detail: "failed" })
      .mockResolvedValueOnce({ code: 1000, data: { total: 0 } });
    await fetchScopeCatalog("test-fail", fetcher);
    const second = await fetchScopeCatalog("test-fail", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(second.code).toBe(1000);
    invalidateScopeCatalog("test-fail");
  });
});
