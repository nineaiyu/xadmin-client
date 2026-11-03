import { describe, expect, it } from "vitest";

import { resolveTokenScopePayload } from "./tokenScopePayload";

describe("PAT 接口范围载荷组装（创建与行内编辑共用）", () => {
  it("空范围且未显式确认：返回 null（调用方拦截并保持弹窗打开）", () => {
    expect(resolveTokenScopePayload([], false)).toBeNull();
  });

  it("空范围且显式确认：unrestricted 为 true（后端 PATCH/创建校验的放行口径）", () => {
    expect(resolveTokenScopePayload([], true)).toEqual({
      scopes: [],
      unrestricted: true
    });
  });

  it("选了范围：unrestricted 恒为 false（开关在两个入口都会自动复位禁用）", () => {
    expect(resolveTokenScopePayload(["api/identity/user$"], true)).toEqual({
      scopes: ["api/identity/user$"],
      unrestricted: false
    });
    expect(resolveTokenScopePayload(["api/identity/user$"], false)).toEqual({
      scopes: ["api/identity/user$"],
      unrestricted: false
    });
  });
});
