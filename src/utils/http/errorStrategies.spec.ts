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
const { clearRouteSnapshotMock } = vi.hoisted(() => ({
  clearRouteSnapshotMock: vi.fn()
}));
vi.mock("@/utils/routeSnapshot", () => ({
  clearRouteSnapshot: clearRouteSnapshotMock
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

describe("403 权限被拒：清路由快照自愈", () => {
  afterEach(() => {
    clearRouteSnapshotMock.mockClear();
  });

  it("普通 403 命中清快照策略，且不接管落定（交默认兜底提示）", () => {
    const ctx = makeCtx({ status: 403, data: { detail: "无权限" } });
    const target = SEND_ERROR_STRATEGIES.find(candidate =>
      candidate.match(ctx)
    );
    expect(target).toBeDefined();
    expect(target!.handle(ctx)).toBe(false);
    expect(clearRouteSnapshotMock).toHaveBeenCalledTimes(1);
    expect(ctx.reject).not.toHaveBeenCalled();
  });

  it("403 + approval_required（审批令牌被拒）走专用策略，不误清快照", () => {
    const ctx = makeCtx({
      status: 403,
      data: { type: "approval_required", detail: "令牌已失效" }
    });
    const target = SEND_ERROR_STRATEGIES.find(candidate =>
      candidate.match(ctx)
    );
    expect(target).toBeDefined();
    expect(target!.handle(ctx)).toBe(true);
    expect(clearRouteSnapshotMock).not.toHaveBeenCalled();
  });
});

describe("429 限流策略", () => {
  const rateLimitStrategy = SEND_ERROR_STRATEGIES.find(candidate =>
    candidate.match(makeCtx({ status: 429, data: {} }))
  );

  /** 前进 fake timers 并清空调用记录 */
  async function flushTimers() {
    await vi.advanceTimersByTimeAsync(10_000);
  }

  afterEach(() => {
    elMessageMock.mockClear();
    vi.useRealTimers();
  });

  it("命中 429", () => {
    expect(rateLimitStrategy).toBeDefined();
    expect(rateLimitStrategy!.match(makeCtx({ status: 429, data: {} }))).toBe(
      true
    );
  });

  it("GET 首次限流：按 Retry-After 延迟后重发一次并 resolve", async () => {
    vi.useFakeTimers();
    const ctx = makeCtx({
      status: 429,
      data: { detail: "请求过于频繁" },
      method: "get"
    }) as Awaited<ReturnType<typeof makeCtx>> & {
      headers?: Record<string, unknown>;
    };
    (ctx as { headers: Record<string, unknown> }).headers = {
      "Retry-After": "2"
    };
    rateLimitStrategy!.handle(ctx);
    // 延迟期内未重发
    expect(ctx.resend).not.toHaveBeenCalled();
    await flushTimers();
    expect(ctx.resend).toHaveBeenCalledTimes(1);
    expect(ctx.resolve).toHaveBeenCalledTimes(1);
    expect(elMessageMock).not.toHaveBeenCalled();
  });

  it("GET 重发后仍 429：不再重试，提示后拒绝（防循环）", () => {
    const ctx = makeCtx({
      status: 429,
      data: { detail: "请求过于频繁" },
      method: "get"
    }) as Awaited<ReturnType<typeof makeCtx>> & {
      headers?: Record<string, unknown>;
    };
    (ctx.config as { _rateLimitRetried?: boolean })._rateLimitRetried = true;
    rateLimitStrategy!.handle(ctx);
    expect(ctx.resend).not.toHaveBeenCalled();
    expect(ctx.resolve).not.toHaveBeenCalled();
    expect(elMessageMock).toHaveBeenCalledWith("请求过于频繁");
    expect(ctx.reject).toHaveBeenCalledWith(
      expect.objectContaining({ detail: "请求过于频繁" })
    );
  });

  it("变更类请求（post）不重发：直接提示并拒绝", () => {
    const ctx = makeCtx({
      status: 429,
      data: { detail: "操作太频繁" },
      method: "post"
    });
    rateLimitStrategy!.handle(ctx);
    expect(ctx.resend).not.toHaveBeenCalled();
    expect(elMessageMock).toHaveBeenCalledWith("操作太频繁");
    expect(ctx.reject).toHaveBeenCalledTimes(1);
  });

  it("相同 detail 3 秒内去重（连发只弹一次），跨窗口恢复弹窗", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const build = () =>
      makeCtx({ status: 429, data: { detail: "操作太频繁" }, method: "post" });
    rateLimitStrategy!.handle(build());
    rateLimitStrategy!.handle(build());
    rateLimitStrategy!.handle(build());
    expect(elMessageMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(1_000_000 + 3_001);
    rateLimitStrategy!.handle(build());
    expect(elMessageMock).toHaveBeenCalledTimes(2);
  });

  it("不同 detail 互不去重", () => {
    vi.useFakeTimers();
    vi.setSystemTime(2_000_000);
    const build = (detail: string) =>
      makeCtx({ status: 429, data: { detail }, method: "post" });
    rateLimitStrategy!.handle(build("限流 A"));
    rateLimitStrategy!.handle(build("限流 B"));
    expect(elMessageMock).toHaveBeenCalledTimes(2);
  });

  it("Retry-After 非法值回退默认 1 秒并钳制上限", async () => {
    const { parseRetryAfterSeconds } = await import("./errorStrategies");
    expect(parseRetryAfterSeconds(undefined)).toBe(1);
    expect(parseRetryAfterSeconds("abc")).toBe(1);
    expect(parseRetryAfterSeconds("0")).toBe(0);
    expect(parseRetryAfterSeconds("120")).toBe(5);
  });
});
