import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 删除影响面预检单测。
 *
 * 核心回归：403（无 impact 权限）或网络异常不再静默放行，
 * 必须让用户显式确认「仍然删除」；只有 404/405（资源无该端点）才静默放行。
 */

const { confirmMock } = vi.hoisted(() => ({
  confirmMock: vi.fn()
}));

vi.mock("@/hooks/useConfirm", () => ({
  useConfirm: () => confirmMock
}));

import { BaseApi } from "@/api/base";
import { confirmImpact, resetImpactSupportCache } from "../impact";

const t = (key: string) => key;

function makeApi(baseApi = "/api/identity/role") {
  return new BaseApi(baseApi);
}

beforeEach(() => {
  confirmMock.mockReset();
  resetImpactSupportCache();
  vi.restoreAllMocks();
});

describe("confirmImpact", () => {
  it("403 预检失败：弹显式确认，用户取消则中止删除", async () => {
    const api = makeApi();
    const request = vi
      .spyOn(api, "request")
      .mockRejectedValue({ detail: "Permission denied" });
    confirmMock.mockResolvedValue(false);

    await expect(confirmImpact(api, ["1"], t)).resolves.toBe(false);

    expect(request).toHaveBeenCalledTimes(1);
    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(confirmMock.mock.calls[0][1]).toMatchObject({
      title: "impact.preflightUnavailableTitle",
      confirmButtonText: "impact.continueDelete",
      danger: true
    });
  });

  it("403 预检失败：用户明确继续时才放行", async () => {
    const api = makeApi();
    vi.spyOn(api, "request").mockRejectedValue({ detail: "Permission denied" });
    confirmMock.mockResolvedValue(true);

    await expect(confirmImpact(api, ["1"], t)).resolves.toBe(true);
    expect(confirmMock).toHaveBeenCalledTimes(1);
  });

  it("404/405：视为资源不支持预检，静默放行且不重复请求", async () => {
    const api = makeApi();
    const request = vi
      .spyOn(api, "request")
      .mockRejectedValue({ detail: 'Method "POST" not allowed.' });

    await expect(confirmImpact(api, ["1"], t)).resolves.toBe(true);
    await expect(confirmImpact(api, ["2"], t)).resolves.toBe(true);

    expect(confirmMock).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("白名单外资源：零请求直接放行", async () => {
    const api = makeApi("/api/identity/user");
    const request = vi.spyOn(api, "request");

    await expect(confirmImpact(api, ["1"], t)).resolves.toBe(true);
    expect(request).not.toHaveBeenCalled();
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it("预检成功且无影响：直接放行", async () => {
    const api = makeApi();
    vi.spyOn(api, "request").mockResolvedValue({
      data: { has_impact: false }
    });

    await expect(confirmImpact(api, ["1"], t)).resolves.toBe(true);
    expect(confirmMock).not.toHaveBeenCalled();
  });
});
