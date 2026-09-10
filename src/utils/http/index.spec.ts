import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AxiosInstance } from "axios";

const {
  instanceMock,
  downloadByDataMock,
  buildUUIDMock,
  confirmMfaMock,
  elMessageMock,
  interceptorHooks
} = vi.hoisted(() => {
  const request = vi.fn();
  // axios 实例的测试替身：http 层仅触达 interceptors 与 request
  const requestUse = vi.fn();
  const responseUse = vi.fn();
  const instance = {
    interceptors: {
      request: { use: requestUse },
      response: { use: responseUse }
    },
    request
  } as unknown as AxiosInstance;
  // 捕获注册进来的拦截器回调，供审批令牌生命周期用例直接驱动
  const interceptorHooks = {
    requestResolved: undefined as ((config: unknown) => unknown) | undefined,
    responseResolved: undefined as ((response: unknown) => unknown) | undefined
  };
  requestUse.mockImplementation((cb: unknown) => {
    interceptorHooks.requestResolved =
      cb as typeof interceptorHooks.requestResolved;
  });
  responseUse.mockImplementation((cb: unknown, _err: unknown) => {
    interceptorHooks.responseResolved =
      cb as typeof interceptorHooks.responseResolved;
  });
  return {
    instanceMock: { instance, request },
    downloadByDataMock: vi.fn(),
    buildUUIDMock: vi.fn(() => "uuid-123"),
    confirmMfaMock: vi.fn(),
    elMessageMock: vi.fn(),
    interceptorHooks
  };
});

vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => instanceMock.instance),
    isCancel: vi.fn(() => false)
  }
}));

vi.mock("@/utils/auth", () => ({
  formatToken: (token: string) => `Bearer ${token}`,
  getToken: vi.fn(() => ""),
  getRefreshToken: vi.fn(() => ""),
  remoteAccessToken: vi.fn(),
  removeToken: vi.fn(),
  setApiLanguage: vi.fn(),
  setToken: vi.fn()
}));

vi.mock("@/store/modules/user", () => ({
  useUserStoreHook: vi.fn(() => ({ handRefreshToken: vi.fn() }))
}));

vi.mock("@/utils/message", () => ({
  message: vi.fn()
}));

vi.mock("element-plus", () => ({
  ElMessage: { error: elMessageMock, warning: elMessageMock }
}));

vi.mock("@/components/ReMfaConfirm", () => ({
  confirmMfa: confirmMfaMock
}));

vi.mock("../progress", () => ({
  default: { start: vi.fn(), done: vi.fn() }
}));

vi.mock("@pureadmin/utils", () => ({
  buildUUID: buildUUIDMock,
  downloadByData: downloadByDataMock
}));

import { clearPendingApprovals, http } from "./index";

describe("PureHttp 请求分发", () => {
  beforeEach(() => {
    instanceMock.request.mockReset();
    instanceMock.request.mockResolvedValue({ data: { code: 1000 } });
  });

  it("get 透传 method / url / params", async () => {
    await http.get("/api/system/user", { params: { page: 1 } });
    expect(instanceMock.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "get",
        url: "/api/system/user",
        params: { page: 1 }
      })
    );
  });

  it("post 透传 method / url / data", async () => {
    await http.post("/api/system/user", { data: { username: "lisi" } });
    expect(instanceMock.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "post",
        url: "/api/system/user",
        data: { username: "lisi" }
      })
    );
  });

  it("upload 强制 multipart Content-Type", async () => {
    await http.upload("/api/system/upload", { dir: "img" }, { file: "x" });
    expect(instanceMock.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "post",
        url: "/api/system/upload",
        params: { dir: "img" },
        data: { file: "x" },
        headers: { "Content-Type": "multipart/form-data" }
      })
    );
  });

  it("download 设置 responseType=blob", async () => {
    await http.download("/api/system/export", { type: "xlsx" });
    expect(instanceMock.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "get",
        url: "/api/system/export",
        params: { type: "xlsx" },
        responseType: "blob"
      })
    );
  });
});

describe("PureHttp.autoDownload", () => {
  beforeEach(() => {
    downloadByDataMock.mockClear();
  });

  it("解析 RFC5987 UTF-8 文件名并触发下载", async () => {
    instanceMock.request.mockResolvedValue({
      data: new Blob(["xlsx-content"]),
      headers: {
        get: (name: string) =>
          name === "content-disposition"
            ? "attachment; filename*=UTF-8''%E6%B5%8B%E8%AF%95.xlsx"
            : "application/octet-stream"
      }
    });
    await http.autoDownload("/api/system/export-data", null, {});
    expect(downloadByDataMock).toHaveBeenCalledWith(
      expect.any(Blob),
      "测试.xlsx"
    );
  });

  it("无 Content-Disposition 时使用随机文件名", async () => {
    instanceMock.request.mockResolvedValue({
      data: new Blob(["x"]),
      headers: { get: () => null }
    });
    await http.autoDownload("/api/system/export-data", null, {});
    expect(downloadByDataMock).toHaveBeenCalledWith(
      expect.any(Blob),
      "uuid-123"
    );
  });
});

describe("PureHttp 412 敏感操作二次验证拦截", () => {
  beforeEach(() => {
    instanceMock.request.mockReset();
    confirmMfaMock.mockReset();
    elMessageMock.mockClear();
    confirmMfaMock.mockResolvedValue({ expire_at: 123456 });
  });

  const make412Error = () =>
    Object.assign(new Error("Request failed with status code 412"), {
      response: {
        status: 412,
        statusText: "Precondition Required",
        data: {
          code: 412,
          type: "user_confirm_required",
          confirm_type: "mfa",
          detail: "该操作需要进行身份二次验证"
        }
      }
    });

  it("412 时唤起验证并自动重发原请求", async () => {
    instanceMock.request
      .mockRejectedValueOnce(make412Error())
      .mockResolvedValueOnce({ data: { code: 1000, detail: "ok" } });

    const result = await http.post("/api/mfa/otp/disable", { data: {} });

    expect(confirmMfaMock).toHaveBeenCalledWith("mfa");
    // 原始请求 + 验证通过后的重发（测试环境拦截器被 mock，返回完整 axios 响应）
    expect(instanceMock.request).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ data: { code: 1000, detail: "ok" } });
  });

  it("验证弹窗被取消时原请求 reject，不重发", async () => {
    confirmMfaMock.mockRejectedValue(new Error("mfa-confirm-cancelled"));
    instanceMock.request.mockRejectedValueOnce(make412Error());

    await expect(
      http.post("/api/mfa/otp/disable", { data: {} })
    ).rejects.toMatchObject({ code: 412 });

    expect(instanceMock.request).toHaveBeenCalledTimes(1);
  });

  it("重发后仍返回 412（确认过期）时不再递归弹窗", async () => {
    instanceMock.request
      .mockRejectedValueOnce(make412Error())
      .mockRejectedValueOnce(make412Error());

    await expect(
      http.post("/api/mfa/otp/disable", { data: {} })
    ).rejects.toMatchObject({ code: 412 });

    // 仅弹一次验证窗
    expect(confirmMfaMock).toHaveBeenCalledTimes(1);
    expect(instanceMock.request).toHaveBeenCalledTimes(2);
    expect(elMessageMock).toHaveBeenCalled();
  });

  it("非 mfa 的 412 响应不走验证流程", async () => {
    instanceMock.request.mockRejectedValueOnce(
      Object.assign(new Error("412"), {
        response: {
          status: 412,
          statusText: "",
          data: { code: 412, detail: "x" }
        }
      })
    );

    await expect(
      http.post("/api/mfa/otp/disable", { data: {} })
    ).rejects.toMatchObject({ code: 412 });

    expect(confirmMfaMock).not.toHaveBeenCalled();
    expect(instanceMock.request).toHaveBeenCalledTimes(1);
  });
});

describe("PureHttp 412 敏感操作审批（code=1002）令牌生命周期", () => {
  const makeApproval412 = () =>
    Object.assign(new Error("Request failed with status code 412"), {
      response: {
        status: 412,
        statusText: "Precondition Required",
        data: {
          code: 1002,
          type: "approval_required",
          detail: "操作已提交审批（单号：A1B2C3D4）",
          data: { approval_id: "token-1", status: "PENDING" }
        }
      }
    });

  const makeApproval403 = () =>
    Object.assign(new Error("Request failed with status code 403"), {
      response: {
        status: 403,
        statusText: "Forbidden",
        data: {
          code: 403,
          type: "approval_required",
          detail: "审批令牌已使用"
        }
      }
    });

  beforeEach(() => {
    instanceMock.request.mockReset();
    confirmMfaMock.mockReset();
    elMessageMock.mockClear();
    clearPendingApprovals();
  });

  it("1002 时暂存令牌、warning 提示、不自动重发、不唤起 MFA 验证", async () => {
    instanceMock.request.mockRejectedValueOnce(makeApproval412());

    await expect(
      http.request("delete", "/api/system/user/1", {})
    ).rejects.toMatchObject({ code: 1002 });

    expect(confirmMfaMock).not.toHaveBeenCalled();
    expect(instanceMock.request).toHaveBeenCalledTimes(1);
    expect(elMessageMock).toHaveBeenCalledWith(
      "操作已提交审批（单号：A1B2C3D4）"
    );
  });

  it("审批通过后重发同指纹请求自动携带 X-Approval-Id，消费成功清除令牌", async () => {
    // 无暂存令牌的请求：拦截器不注入审批头
    const plainConfig = {
      method: "delete",
      url: "/api/system/user/1",
      headers: {} as Record<string, string>
    };
    await interceptorHooks.requestResolved?.(plainConfig);
    expect(plainConfig.headers["X-Approval-Id"]).toBeUndefined();

    // 触发 1002：令牌入暂存表
    instanceMock.request.mockRejectedValueOnce(makeApproval412());
    await expect(
      http.request("delete", "/api/system/user/1", {})
    ).rejects.toBeTruthy();

    // 有暂存令牌的同指纹请求：拦截器注入令牌
    const retryConfig = {
      method: "delete",
      url: "/api/system/user/1",
      headers: {} as Record<string, string>
    };
    await interceptorHooks.requestResolved?.(retryConfig);
    expect(retryConfig.headers["X-Approval-Id"]).toBe("token-1");

    // 响应拦截器在业务码 1000 时清除令牌：再次重发不再携带
    interceptorHooks.responseResolved?.({
      config: { ...retryConfig, _approvalId: "token-1" },
      data: { code: 1000 },
      headers: {}
    });
    const thirdConfig = {
      method: "delete",
      url: "/api/system/user/1",
      headers: {} as Record<string, string>
    };
    await interceptorHooks.requestResolved?.(thirdConfig);
    expect(thirdConfig.headers["X-Approval-Id"]).toBeUndefined();
  });

  it("对象请求体消费成功后清理暂存令牌（回归：axios 会改写 config.data）", async () => {
    // 历史缺陷：响应期用 config.data 重算 key，而 axios 已把对象改写成 JSON 字符串，
    // key 不一致 → 令牌清不掉，下次同请求误带已消费令牌返回 403
    const body = { pks: ["pk-a"] };
    instanceMock.request.mockRejectedValueOnce(makeApproval412());
    await expect(
      http.request("post", "/api/system/user/batch-destroy", { data: body })
    ).rejects.toBeTruthy();

    const retryConfig = {
      method: "post",
      url: "/api/system/user/batch-destroy",
      data: { ...body },
      headers: {} as Record<string, string>
    };
    await interceptorHooks.requestResolved?.(retryConfig);
    expect(retryConfig.headers["X-Approval-Id"]).toBe("token-1");

    // 响应期 config.data 已被 axios 序列化为字符串，令牌仍须按请求期 key 清理
    interceptorHooks.responseResolved?.({
      config: { ...retryConfig, data: JSON.stringify(body) },
      data: { code: 1000 },
      headers: {}
    });

    const thirdConfig = {
      method: "post",
      url: "/api/system/user/batch-destroy",
      data: { ...body },
      headers: {} as Record<string, string>
    };
    await interceptorHooks.requestResolved?.(thirdConfig);
    expect(thirdConfig.headers["X-Approval-Id"]).toBeUndefined();
  });

  it("令牌被拒（403 approval_required）后清除暂存令牌", async () => {
    instanceMock.request
      .mockRejectedValueOnce(makeApproval412())
      .mockRejectedValueOnce(makeApproval403());

    await expect(
      http.request("delete", "/api/system/user/2", {})
    ).rejects.toBeTruthy();
    await expect(
      http.request("delete", "/api/system/user/2", {})
    ).rejects.toBeTruthy();

    // 第二次请求虽携带了暂存令牌，但消费被拒 403 后令牌已清除：
    // 第三次重发不再注入
    const thirdConfig = {
      method: "delete",
      url: "/api/system/user/2",
      headers: {}
    };
    await interceptorHooks.requestResolved?.(thirdConfig);
    expect(
      (thirdConfig.headers as Record<string, string>)["X-Approval-Id"]
    ).toBeUndefined();
  });

  it("不同指纹（body 不同）不串用暂存令牌", async () => {
    instanceMock.request.mockRejectedValueOnce(makeApproval412());
    await expect(
      http.request("post", "/api/system/user/batch-destroy", {
        data: ["pk-a"]
      })
    ).rejects.toBeTruthy();

    const otherBodyConfig = {
      method: "post",
      url: "/api/system/user/batch-destroy",
      data: ["pk-b"],
      headers: {}
    };
    await interceptorHooks.requestResolved?.(otherBodyConfig);
    expect(
      (otherBodyConfig.headers as Record<string, string>)["X-Approval-Id"]
    ).toBeUndefined();
  });
});
