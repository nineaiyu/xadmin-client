import { afterEach, describe, expect, it, vi } from "vitest";

const { elMessageMock, hasSessionMock, isCookieAuthSessionMock, refreshMock } =
  vi.hoisted(() => ({
    elMessageMock: vi.fn(),
    hasSessionMock: vi.fn(),
    isCookieAuthSessionMock: vi.fn(),
    refreshMock: vi.fn()
  }));

// 提示统一走项目 message 包装（pure-message 视觉）：断言按包装签名 (text, params)
vi.mock("@/utils/message", () => ({
  message: elMessageMock
}));
vi.mock("@/utils/auth", () => ({
  remoteAccessToken: vi.fn(),
  removeToken: vi.fn(),
  isCookieAuthSession: isCookieAuthSessionMock,
  hasSession: hasSessionMock
}));
vi.mock("./refreshToken", () => ({
  refreshAccessToken: refreshMock
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
  } as Parameters<
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
    expect(elMessageMock).toHaveBeenCalledWith("功能未启用 (chat)", {
      type: "warning"
    });
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
    expect(elMessageMock).toHaveBeenCalledWith("功能未启用", {
      type: "warning"
    });
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
    expect(elMessageMock).toHaveBeenCalledWith("请求过于频繁", {
      type: "error"
    });
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
    expect(elMessageMock).toHaveBeenCalledWith("操作太频繁", { type: "error" });
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

const { announceMock } = vi.hoisted(() => ({ announceMock: vi.fn() }));
vi.mock("@/utils/announcer", () => ({ announce: announceMock }));

describe("业务 400 策略（PROTECT 引用不可删除 code=998 等）", () => {
  afterEach(() => {
    elMessageMock.mockClear();
    announceMock.mockClear();
  });

  it("400 命中：提示 detail + 读屏播报并 reject（不得静默）", () => {
    const badRequest = SEND_ERROR_STRATEGIES.find(candidate =>
      candidate.match(makeCtx({ status: 400, data: {} }))
    );
    expect(badRequest).toBeDefined();
    const ctx = makeCtx({
      status: 400,
      data: { code: 998, detail: "该数据被其它部门引用，无法删除" }
    });
    expect(badRequest!.match(ctx)).toBe(true);
    expect(badRequest!.handle(ctx)).toBe(true);
    expect(elMessageMock).toHaveBeenCalledWith(
      "该数据被其它部门引用，无法删除",
      { type: "error" }
    );
    expect(announceMock).toHaveBeenCalledWith("该数据被其它部门引用，无法删除");
    expect(ctx.reject).toHaveBeenCalledWith({
      code: 998,
      detail: "该数据被其它部门引用，无法删除"
    });
  });

  it("非 400 不命中（401/403/404 等由各自策略处理）", () => {
    const badRequest = SEND_ERROR_STRATEGIES.find(candidate =>
      candidate.match(makeCtx({ status: 400, data: {} }))
    );
    expect(badRequest!.match(makeCtx({ status: 401, data: {} }))).toBe(false);
    expect(badRequest!.match(makeCtx({ status: 404, data: {} }))).toBe(false);
  });
});

describe("401+40001 access 过期策略（双模式）", () => {
  const tokenExpired = SEND_ERROR_STRATEGIES.find(candidate =>
    candidate.match(makeCtx({ status: 401, data: { code: 40001 } }))
  );

  afterEach(() => {
    elMessageMock.mockClear();
    redirectToLoginMock.mockClear();
    refreshMock.mockReset();
    isCookieAuthSessionMock.mockReset().mockReturnValue(false);
    hasSessionMock.mockReset().mockReturnValue(false);
  });

  it("header 模式：删本地 access 后原样重发（不在此处刷新）", () => {
    expect(tokenExpired).toBeDefined();
    const ctx = makeCtx({ status: 401, data: { code: 40001 } });
    expect(tokenExpired!.handle(ctx)).toBe(true);
    expect(refreshMock).not.toHaveBeenCalled();
    expect(ctx.reissue).toHaveBeenCalled();
  });

  it("Cookie 模式：经单飞刷新（Cookie 轮换）后重发一次", async () => {
    isCookieAuthSessionMock.mockReturnValue(true);
    const ctx = makeCtx({ status: 401, data: { code: 40001 } });
    refreshMock.mockResolvedValue({ ok: true, data: {} });
    expect(tokenExpired!.handle(ctx)).toBe(true);
    // resolve 采纳了「刷新后重发」的 Promise，等它落定
    const chained = (ctx.resolve as ReturnType<typeof vi.fn>).mock.calls[0][0];
    await chained;
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(ctx.reissue).toHaveBeenCalled();
  });

  it("Cookie 模式刷新失败：清本地标记 + 跳登录，外层以原错误体拒绝", async () => {
    isCookieAuthSessionMock.mockReturnValue(true);
    const errorBody = { code: 40001, detail: "令牌无效或已过期" };
    const ctx = makeCtx({ status: 401, data: errorBody });
    refreshMock.mockResolvedValue({ ok: false, detail: "refresh expired" });
    expect(tokenExpired!.handle(ctx)).toBe(true);
    const chained = (ctx.resolve as ReturnType<typeof vi.fn>).mock.calls[0][0];
    await expect(chained).rejects.toEqual(errorBody);
    expect(redirectToLoginMock).toHaveBeenCalled();
  });

  it("重试后仍 40001：防死循环，提示 + 清 token + 跳登录", () => {
    const ctx = makeCtx({
      status: 401,
      data: { code: 40001, detail: "令牌无效或已过期" }
    });
    (ctx.config as Record<string, unknown>)._tokenRetried = true;
    expect(tokenExpired!.handle(ctx)).toBe(true);
    expect(redirectToLoginMock).toHaveBeenCalled();
    expect(ctx.reject).toHaveBeenCalled();
  });

  it("Cookie 模式缺凭证（code=401，access Cookie 自然过期消失）且有会话标记：命中本策略经单飞刷新后重发", async () => {
    isCookieAuthSessionMock.mockReturnValue(true);
    hasSessionMock.mockReturnValue(true);
    const ctx = makeCtx({ status: 401, data: { code: 401, detail: "未授权" } });
    expect(tokenExpired!.match(ctx)).toBe(true);
    refreshMock.mockResolvedValue({ ok: true, data: {} });
    expect(tokenExpired!.handle(ctx)).toBe(true);
    const chained = (ctx.resolve as ReturnType<typeof vi.fn>).mock.calls[0][0];
    await chained;
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(ctx.reissue).toHaveBeenCalled();
  });

  it("Cookie 模式缺凭证但无会话标记（真实未登录）：不命中本策略，交 unauthorizedStrategy 清 token 跳登录", () => {
    isCookieAuthSessionMock.mockReturnValue(true);
    hasSessionMock.mockReturnValue(false);
    const ctx = makeCtx({ status: 401, data: { code: 401, detail: "未授权" } });
    expect(tokenExpired!.match(ctx)).toBe(false);
    const unauthorized = SEND_ERROR_STRATEGIES.find(
      candidate =>
        candidate !== tokenExpired &&
        candidate.match(makeCtx({ status: 401, data: { code: 401 } }))
    );
    expect(unauthorized).toBeDefined();
    isCookieAuthSessionMock.mockReturnValue(false);
    expect(unauthorized!.handle(ctx)).toBe(true);
    expect(redirectToLoginMock).toHaveBeenCalled();
    expect(ctx.reject).toHaveBeenCalled();
  });

  it("header 模式 code=401（缺凭证）不命中本策略（本地无 token 由请求拦截器先行刷新兜底）", () => {
    const ctx = makeCtx({ status: 401, data: { code: 401, detail: "未授权" } });
    expect(tokenExpired!.match(ctx)).toBe(false);
  });
});
