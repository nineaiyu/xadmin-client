import { describe, expect, it } from "vitest";

import { resolveMyScopeState } from "../myScopeState";

describe("我的管辖视图状态", () => {
  it("无权限优先于其他状态：不再把 403 显示成空数据", () => {
    expect(
      resolveMyScopeState({ canManaged: false, loadError: "", deptCount: 0 })
    ).toBe("denied");
    expect(
      resolveMyScopeState({
        canManaged: false,
        loadError: "Permission denied",
        deptCount: 3
      })
    ).toBe("denied");
  });

  it("有权限但接口失败：进入可重试错误态", () => {
    expect(
      resolveMyScopeState({
        canManaged: true,
        loadError: "Permission denied",
        deptCount: 0
      })
    ).toBe("error");
  });

  it("有权限且确实没有管辖部门：空态", () => {
    expect(
      resolveMyScopeState({ canManaged: true, loadError: "", deptCount: 0 })
    ).toBe("empty");
  });

  it("有权限且有数据：正常渲染", () => {
    expect(
      resolveMyScopeState({ canManaged: true, loadError: "", deptCount: 2 })
    ).toBe("ready");
  });
});
