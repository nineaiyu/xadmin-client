import { describe, expect, it, vi } from "vitest";

vi.mock("vue-i18n", async importOriginal => {
  const actual = await importOriginal<typeof import("vue-i18n")>();
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) };
});
vi.mock("@/router/utils", () => ({ hasAuth: vi.fn(() => true) }));
vi.mock("@/views/system/hooks", () => ({
  usePublicHooks: () => ({ tagStyle: vi.fn(() => ({})) })
}));
vi.mock("@/api/user/logs", () => ({
  userLoginLogApi: {
    baseApi: "/api/audit/user/log",
    list: vi.fn(),
    columns: vi.fn(),
    fields: vi.fn()
  }
}));

import { hasAuth } from "@/router/utils";
import { useUserLoginLog } from "./useUserLoginLog";

describe("useUserLoginLog（安全日志列表装配）", () => {
  it("请求前缀指向四域独立前缀 /api/audit/user/log", () => {
    const { api } = useUserLoginLog();

    expect(api.baseApi).toBe("/api/audit/user/log");
  });

  it("列表权限门取自 list:UserLoginLog 权限点", () => {
    useUserLoginLog();

    expect(hasAuth).toHaveBeenCalledWith("list:UserLoginLog");
  });

  it("分页默认口径稳定（每页 15 条）", () => {
    const { pagination } = useUserLoginLog();

    expect(pagination.pageSize).toBe(15);
    expect(pagination.currentPage).toBe(1);
    expect(pagination.total).toBe(0);
  });

  it("status 列注入布尔标签渲染器（成功/失败文案）", () => {
    const { listColumnsFormat } = useUserLoginLog();

    // 框架按 column._column.key 分派渲染器（列元数据的业务字段名）
    const columns = listColumnsFormat([
      { prop: "status", label: "status", _column: { key: "status" } },
      { prop: "ipaddress", label: "ipaddress", _column: { key: "ipaddress" } }
    ] as never);

    expect(typeof columns[0]["cellRenderer"]).toBe("function");
    expect(columns[1]["cellRenderer"]).toBeUndefined();
  });
});
