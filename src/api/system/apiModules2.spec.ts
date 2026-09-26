import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestMock, uploadMock } = vi.hoisted(() => ({
  requestMock: vi.fn(),
  uploadMock: vi.fn()
}));

vi.mock("@/utils/http", () => ({
  http: { request: requestMock, upload: uploadMock }
}));

import { userApi } from "./user";
import {
  crontabScheduleApi,
  intervalScheduleApi,
  periodicTaskApi,
  taskCenterApi,
  taskExecutionApi
} from "./task";
import { configApi } from "@/api/config";
import { countriesApi, resourcesIDCacheApi } from "@/api/common";

/** api/system 第二批：用户管理、任务中心/定时任务、平台配置、通用缓存端点。 */

describe("userApi 用户管理动作", () => {
  beforeEach(() => {
    requestMock.mockReset();
    uploadMock.mockReset();
  });

  it("batchUpdate / upload（自定义 action 回退 upload）", () => {
    userApi.batchUpdate([1], { dept: 2 });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/user/batch-update",
      {
        params: {},
        data: { pks: [1], fields: { dept: 2 }, _write_marker: "batchUpdate" }
      },
      {}
    );

    userApi.upload(9, { avatar: "x" }, "avatar");
    expect(uploadMock).toHaveBeenLastCalledWith(
      "/api/system/user/9/avatar",
      {},
      { avatar: "x" },
      undefined
    );

    userApi.upload(9, { file: "x" });
    expect(uploadMock).toHaveBeenLastCalledWith(
      "/api/system/user/9/upload",
      {},
      { file: "x" },
      undefined
    );
  });

  it("resetPassword / invite / empower / unblock / resetMfa / logout", () => {
    userApi.resetPassword(1, { password: "x" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/user/1/reset-password",
      { params: {}, data: { password: "x" } },
      {}
    );

    userApi.invite(1, { email: "a@b.c" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/user/1/invite",
      { params: {}, data: { email: "a@b.c" } },
      {}
    );

    userApi.empower(1, { roles: [3] });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/user/1/empower",
      { params: {}, data: { roles: [3] } },
      {}
    );

    userApi.unblock(1);
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/user/1/unblock",
      { params: {}, data: undefined },
      {}
    );

    userApi.resetMfa(1);
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/user/1/reset-mfa",
      { params: {}, data: undefined },
      {}
    );

    userApi.logout(1, { reason: "admin" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/user/1/logout",
      { params: {}, data: { reason: "admin" } },
      {}
    );
  });

  it("preview / previewTrial / previewFieldTrial（字段试算带 scope 标记）", () => {
    userApi.preview(1);
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/user/1/preview",
      { params: {}, data: {} },
      {}
    );

    userApi.previewTrial(1, { model: "system.User" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/user/1/preview/trial",
      { params: {}, data: { model: "system.User" } },
      {}
    );

    userApi.previewFieldTrial(1, { menu: "user" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/user/1/preview/trial",
      { params: {}, data: { menu: "user", scope: "field" } },
      {}
    );
  });

  it("IM 绑定：列表 / 代录 / 解绑", () => {
    userApi.imBindingList(1);
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/user/1/im-binding",
      { params: {}, data: {} },
      {}
    );

    userApi.imBinding(1, { provider: "wecom", subject: "s1" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/user/1/im-binding",
      { params: {}, data: { provider: "wecom", subject: "s1" } },
      {}
    );

    userApi.imUnbind(1, "wecom");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/user/1/im-unbind",
      { params: {}, data: { provider: "wecom" } },
      {}
    );
  });
});

describe("periodicTaskApi 定时任务", () => {
  beforeEach(() => requestMock.mockReset());

  it("run / batchRun / batchEnable（enabled 省略透传 undefined）", () => {
    periodicTaskApi.run(5);
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/tasks/periodic/5/run",
      { params: {}, data: {} },
      {}
    );

    periodicTaskApi.batchRun([1, 2]);
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/tasks/periodic/batch-run",
      { params: {}, data: [1, 2] },
      {}
    );

    periodicTaskApi.batchEnable([1, 2]);
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/tasks/periodic/batch-enable",
      { params: {}, data: { pks: [1, 2], enabled: undefined } },
      {}
    );

    periodicTaskApi.batchEnable([3], true);
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/tasks/periodic/batch-enable",
      { params: {}, data: { pks: [3], enabled: true } },
      {}
    );
  });

  it("clone / registered / batchUpdate", () => {
    periodicTaskApi.clone(7);
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/tasks/periodic/7/clone",
      { params: {}, data: {} },
      {}
    );

    periodicTaskApi.registered();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/tasks/periodic/registered",
      { params: {}, data: {} },
      {}
    );

    periodicTaskApi.batchUpdate([1], { is_active: false });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/tasks/periodic/batch-update",
      {
        params: {},
        data: {
          pks: [1],
          fields: { is_active: false },
          _write_marker: "batchUpdate"
        }
      },
      {}
    );
  });

  it("crontab / interval 走通用 BaseApi，执行历史 stats", () => {
    crontabScheduleApi.list({ page: 1 });
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/tasks/crontab",
      { params: { page: 1 }, data: {} },
      {}
    );

    intervalScheduleApi.list();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/tasks/interval",
      { params: {}, data: {} },
      {}
    );

    taskExecutionApi.stats();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/tasks/executions/stats",
      { params: {}, data: {} },
      {}
    );
  });
});

describe("taskCenterApi 任务中心", () => {
  beforeEach(() => requestMock.mockReset());

  it("getUnified 分页查询透传", () => {
    taskCenterApi.getUnified({ type: "export", page: 2, size: 20 });
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/tasks/unified",
      { params: { type: "export", page: 2, size: 20 }, data: {} },
      {}
    );
  });

  it("cancel / rerun 带 type+pk 载荷", () => {
    taskCenterApi.cancel("task", "t1");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/tasks/unified/cancel",
      { params: {}, data: { type: "task", pk: "t1" } },
      {}
    );

    taskCenterApi.rerun("export", "e1");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/tasks/unified/rerun",
      { params: {}, data: { type: "export", pk: "e1" } },
      {}
    );
  });
});

describe("configApi 平台配置", () => {
  beforeEach(() => requestMock.mockReset());

  it("getConfig / setConfig 按配置名拼端点", () => {
    configApi.getConfig("WEB_MFA");
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/configs/WEB_MFA",
      { params: {}, data: {} },
      {}
    );

    configApi.setConfig("WEB_MFA", { enabled: true }, "put");
    expect(requestMock).toHaveBeenLastCalledWith(
      "put",
      "/api/system/configs/WEB_MFA",
      { params: {}, data: { enabled: true } },
      {}
    );
  });

  it("站点配置读写与重置", () => {
    configApi.getSiteConfig();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/configs/WEB_SITE_CONFIG",
      { params: {}, data: {} },
      {}
    );

    configApi.setSiteConfig({ title: "x" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "patch",
      "/api/system/configs/WEB_SITE_CONFIG",
      { params: {}, data: { title: "x" } },
      {}
    );

    configApi.resetSiteConfig();
    expect(requestMock).toHaveBeenLastCalledWith(
      "delete",
      "/api/system/configs/WEB_SITE_CONFIG",
      { params: {}, data: {} },
      {}
    );
  });
});

describe("common 通用端点", () => {
  it("resourcesIDCacheApi / countriesApi", () => {
    resourcesIDCacheApi([1, 2]);
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/common/resources/cache",
      { data: { resources: [1, 2] } }
    );

    countriesApi();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/common/countries"
    );
  });
});
