import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestMock, uploadMock } = vi.hoisted(() => ({
  requestMock: vi.fn(),
  uploadMock: vi.fn()
}));

vi.mock("@/utils/http", () => ({
  http: { request: requestMock, upload: uploadMock }
}));

import { loadPatScopeCatalog, personalAccessTokenApi } from "@/api/user/token";
import { userInfoApi } from "./userinfo";
import { userNoticeReadApi } from "./notice";

/** api/user 薄封装契约：URL 拼接与载荷形态（错拼的失败模式是静默 404）。 */

describe("userInfoApi 个人信息", () => {
  beforeEach(() => {
    requestMock.mockReset();
    uploadMock.mockReset();
  });

  it("retrieve 取本人信息（ViewBase 形态，URL 不拼 pk）", () => {
    userInfoApi.retrieve({ expand: "roles" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/userinfo",
      { params: { expand: "roles" }, data: {} },
      {}
    );
  });

  it("choices / resetPassword / bind", () => {
    userInfoApi.choices();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/userinfo/choices",
      { params: {}, data: {} },
      {}
    );

    userInfoApi.resetPassword({ old: "a", new: "b" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/userinfo/reset-password",
      { params: {}, data: { old: "a", new: "b" } },
      {}
    );

    userInfoApi.bind({ email: "a@b.c" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/userinfo/bind",
      { params: {}, data: { email: "a@b.c" } },
      {}
    );
  });

  it("upload 走 http.upload 通道", () => {
    userInfoApi.upload({ avatar: "x" });
    expect(uploadMock).toHaveBeenLastCalledWith(
      "/api/system/userinfo/upload",
      {},
      { avatar: "x" }
    );
  });
});

describe("userNoticeReadApi 站内信已读", () => {
  beforeEach(() => requestMock.mockReset());

  it("unread / allRead / batchRead", () => {
    userNoticeReadApi.unread({ limit: 10 });
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/notifications/site-messages/unread",
      { params: { limit: 10 }, data: {} },
      {}
    );

    userNoticeReadApi.allRead();
    expect(requestMock).toHaveBeenLastCalledWith(
      "patch",
      "/api/notifications/site-messages/all-read",
      { params: {}, data: {} },
      {}
    );

    userNoticeReadApi.batchRead({ pks: [1, 2] });
    expect(requestMock).toHaveBeenLastCalledWith(
      "patch",
      "/api/notifications/site-messages/batch-read",
      { params: {}, data: { pks: [1, 2] } },
      {}
    );
  });
});

describe("personalAccessTokenApi 访问令牌", () => {
  beforeEach(() => requestMock.mockReset());

  it("logs / stats / scopeOptions", () => {
    personalAccessTokenApi.logs("pat1", { limit: 5 });
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/personal-access-tokens/pat1/logs",
      { params: { limit: 5 }, data: {} },
      {}
    );

    personalAccessTokenApi.stats("pat1");
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/personal-access-tokens/pat1/stats",
      { params: {}, data: {} },
      {}
    );

    personalAccessTokenApi.scopeOptions();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/personal-access-tokens/scope-options",
      { params: {}, data: {} },
      {}
    );
  });

  it("loadPatScopeCatalog 经共享目录缓存拉取一次", async () => {
    requestMock.mockResolvedValue({
      code: 200,
      data: { categories: [] }
    });
    await loadPatScopeCatalog();
    expect(requestMock).toHaveBeenCalledWith(
      "get",
      "/api/system/personal-access-tokens/scope-options",
      { params: {}, data: {} },
      {}
    );
    // 缓存命中路径：scopeOptions 不再触发第二次请求
    const count = requestMock.mock.calls.filter(
      ([, url]) => url === "/api/system/personal-access-tokens/scope-options"
    ).length;
    expect(count).toBe(1);
  });
});
