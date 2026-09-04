import { beforeEach, describe, expect, it, vi } from "vitest";

const { getTokenMock, getRefreshTokenMock, setTokenMock, refreshTokenApiMock } =
  vi.hoisted(() => ({
    getTokenMock: vi.fn(),
    getRefreshTokenMock: vi.fn(),
    setTokenMock: vi.fn(),
    refreshTokenApiMock: vi.fn()
  }));

vi.mock("@/utils/auth", () => ({
  getToken: getTokenMock,
  getRefreshToken: getRefreshTokenMock,
  setToken: setTokenMock
}));

vi.mock("@/api/auth", () => ({
  refreshTokenApi: refreshTokenApiMock
}));

import { getUsedAccessToken } from "./token";

describe("getUsedAccessToken", () => {
  beforeEach(() => {
    getTokenMock.mockReset();
    getRefreshTokenMock.mockReset();
    setTokenMock.mockReset();
    refreshTokenApiMock.mockReset();
  });

  it("已有 access token 直接返回且不调用刷新接口", async () => {
    getTokenMock.mockReturnValue("access-token");
    await expect(getUsedAccessToken()).resolves.toBe("access-token");
    expect(refreshTokenApiMock).not.toHaveBeenCalled();
    expect(getRefreshTokenMock).not.toHaveBeenCalled();
  });

  it("无 access 且无 refresh 返回 undefined", async () => {
    getTokenMock.mockReturnValue("");
    getRefreshTokenMock.mockReturnValue("");
    await expect(getUsedAccessToken()).resolves.toBeUndefined();
    expect(refreshTokenApiMock).not.toHaveBeenCalled();
  });

  it("无 access 有 refresh 走刷新流程并返回新 token", async () => {
    getTokenMock.mockReturnValueOnce("").mockReturnValueOnce("new-token");
    getRefreshTokenMock.mockReturnValue("refresh-1");
    refreshTokenApiMock.mockResolvedValue({
      data: { access: "new", refresh: "r" }
    });
    await expect(getUsedAccessToken()).resolves.toBe("new-token");
    expect(refreshTokenApiMock).toHaveBeenCalledWith({ refresh: "refresh-1" });
    expect(setTokenMock).toHaveBeenCalledWith({
      access: "new",
      refresh: "r"
    });
  });

  it("refreshTokenApi 失败时向上抛错", async () => {
    getTokenMock.mockReturnValue("");
    getRefreshTokenMock.mockReturnValue("refresh-1");
    refreshTokenApiMock.mockRejectedValue(new Error("network"));
    await expect(getUsedAccessToken()).rejects.toThrow("network");
  });
});
