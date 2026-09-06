import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AxiosInstance } from "axios";

const {
  instanceMock,
  downloadByDataMock,
  buildUUIDMock,
  confirmMfaMock,
  elMessageMock
} = vi.hoisted(() => {
  const request = vi.fn();
  // axios 实例的测试替身：http 层仅触达 interceptors 与 request
  const instance = {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() }
    },
    request
  } as unknown as AxiosInstance;
  return {
    instanceMock: { instance, request },
    downloadByDataMock: vi.fn(),
    buildUUIDMock: vi.fn(() => "uuid-123"),
    confirmMfaMock: vi.fn(),
    elMessageMock: vi.fn()
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
  ElMessage: { error: elMessageMock }
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

import { http } from "./index";

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
