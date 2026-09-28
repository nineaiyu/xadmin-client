import { afterEach, describe, expect, it, vi } from "vitest";

const { elMessageMock } = vi.hoisted(() => ({ elMessageMock: vi.fn() }));

vi.mock("element-plus", () => ({
  ElMessage: { error: elMessageMock, warning: elMessageMock }
}));
vi.mock("@/utils/auth", () => ({
  remoteAccessToken: vi.fn(),
  removeToken: vi.fn()
}));
vi.mock("./pendingApproval", () => ({
  approvalKey: vi.fn(() => "key"),
  deletePendingApproval: vi.fn(),
  setPendingApproval: vi.fn()
}));
const { redirectToLoginMock, redirectToModuleDisabledMock } = vi.hoisted(
  () => ({
    redirectToLoginMock: vi.fn(),
    redirectToModuleDisabledMock: vi.fn()
  })
);
vi.mock("./redirect", () => ({
  redirectToLogin: redirectToLoginMock,
  redirectToModuleDisabled: redirectToModuleDisabledMock
}));

import { SEND_ERROR_STRATEGIES } from "./errorStrategies";

/** 构造策略上下文（仅填 match/handle 触达的字段） */
function makeCtx({
  status,
  data,
  module,
  method
}: {
  status: number;
  data: Record<string, unknown>;
  module?: unknown;
  method?: string;
}) {
  return {
    config: { method },
    status,
    statusText: "Not Found",
    data: module === undefined ? data : { ...data, module },
    resend: vi.fn(),
    reissue: vi.fn(),
    resolve: vi.fn(),
    reject: vi.fn()
  } as unknown as Parameters<
    NonNullable<(typeof SEND_ERROR_STRATEGIES)[number]>["match"]
  >[0];
}

const strategy = SEND_ERROR_STRATEGIES.find(candidate =>
  candidate.match(makeCtx({ status: 404, data: { code: 1001 } }))
);

describe("模块停用网关 404（code=1001）策略", () => {
  afterEach(() => {
    elMessageMock.mockClear();
    redirectToModuleDisabledMock.mockClear();
  });

  it("404 + 1001 命中且带模块 id 时提示 detail + 模块名并 reject", () => {
    expect(strategy).toBeDefined();
    const ctx = makeCtx({
      status: 404,
      data: { code: 1001, detail: "功能未启用" },
      module: "chat"
    });
    expect(strategy!.match(ctx)).toBe(true);
    expect(strategy!.handle(ctx)).toBe(true);
    expect(elMessageMock).toHaveBeenCalledWith("功能未启用 (chat)");
    expect(ctx.reject).toHaveBeenCalledWith(
      expect.objectContaining({ code: 1001, module: "chat" })
    );
  });

  it("响应体未携带 module 字段时仅提示 detail", () => {
    const ctx = makeCtx({
      status: 404,
      data: { code: 1001, detail: "功能未启用" }
    });
    expect(strategy!.match(ctx)).toBe(true);
    strategy!.handle(ctx);
    expect(elMessageMock).toHaveBeenCalledWith("功能未启用");
  });

  it("GET 页面取数失败 → 整页化跳「模块已停用」并携带模块 id", () => {
    const ctx = makeCtx({
      status: 404,
      data: { code: 1001, detail: "功能未启用" },
      module: "chat",
      method: "get"
    });
    strategy!.handle(ctx);
    expect(redirectToModuleDisabledMock).toHaveBeenCalledWith("chat");
  });

  it("变更类请求（post）失败仅提示，不整页跳转", () => {
    const ctx = makeCtx({
      status: 404,
      data: { code: 1001, detail: "功能未启用" },
      module: "chat",
      method: "post"
    });
    strategy!.handle(ctx);
    expect(redirectToModuleDisabledMock).not.toHaveBeenCalled();
  });

  it("已在停用提示页时不再跳转（页面自身刷新会再次命中网关）", () => {
    const original = window.location.hash;
    window.location.hash = "#/error/module-disabled?module=chat";
    try {
      const ctx = makeCtx({
        status: 404,
        data: { code: 1001, detail: "功能未启用" },
        module: "chat",
        method: "get"
      });
      strategy!.handle(ctx);
      expect(redirectToModuleDisabledMock).not.toHaveBeenCalled();
    } finally {
      window.location.hash = original;
    }
  });

  it("普通 404（非网关拦截）不命中", () => {
    const ctx = makeCtx({ status: 404, data: { detail: "not found" } });
    expect(strategy!.match(ctx)).toBe(false);
  });

  it("403/425 等其他状态码不命中", () => {
    expect(
      strategy!.match(makeCtx({ status: 403, data: { code: 1001 } }))
    ).toBe(false);
    expect(strategy!.match(makeCtx({ status: 425, data: {} }))).toBe(false);
  });
});
