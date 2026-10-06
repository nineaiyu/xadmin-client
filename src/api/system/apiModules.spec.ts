import { describe, expect, it, vi } from "vitest";

const { requestMock, autoDownloadMock } = vi.hoisted(() => ({
  requestMock: vi.fn(),
  autoDownloadMock: vi.fn()
}));

vi.mock("@/utils/http", () => ({
  http: { request: requestMock, autoDownload: autoDownloadMock }
}));

import { dataDictApi } from "./dict";
import { userOnlineApi } from "./online";
import { deptApi } from "./dept";
import { roleApi } from "./role";
import { menuApi } from "./menu";
import { maskApi } from "./mask";
import { modelLabelFieldApi } from "./field";
import { exportRecordApi } from "./export";
import { importRecordApi } from "./import";
import { systemConfigApi } from "./config/system";
import { userConfigApi } from "./config/user";
import { loginLogApi } from "./logs/login";

/**
 * api/system 第一批：系统与权限基础域的薄封装契约测试，逐方法断言「方法 + URL + 载荷」。
 *
 * BaseApi 继承的通用 CRUD（list/create/...）在 base.spec 覆盖，这里只打
 * 各模块自己声明的端点——URL 拼接或载荷形态拼错时的失败模式是静默 404，
 * 靠该层测试在构建期变红。
 */

describe("dataDictApi 字典", () => {
  it("items 按类型 code 查询", () => {
    dataDictApi.items("gender");
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/dict/items",
      { params: { code: "gender" }, data: {} },
      {}
    );
  });

  it("batchActive 不传 isActive 时按取反语义透传 undefined", () => {
    dataDictApi.batchActive([1, 2]);
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/dict/batch-active",
      { params: {}, data: { pks: [1, 2], is_active: undefined } },
      {}
    );
  });

  it("move / refreshCache / batchUpdate 端点与载荷", () => {
    dataDictApi.move(3, "up");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/dict/3/move",
      { params: {}, data: { direction: "up" } },
      {}
    );

    dataDictApi.refreshCache();
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/dict/refresh-cache",
      { params: {}, data: {} },
      {}
    );

    dataDictApi.batchUpdate([1], { color: "red" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/dict/batch-update",
      {
        params: {},
        data: {
          pks: [1],
          fields: { color: "red" },
          _write_marker: "batchUpdate"
        }
      },
      {}
    );
  });
});

describe("userOnlineApi 在线用户", () => {
  it("forceLogout / batchForceLogout", () => {
    userOnlineApi.forceLogout(5);
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/online/5/force-logout",
      { params: {}, data: {} },
      {}
    );

    userOnlineApi.batchForceLogout(["a", "b"]);
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/online/batch-force-logout",
      { params: {}, data: ["a", "b"] },
      {}
    );
  });
});

describe("deptApi / roleApi 授权与预览", () => {
  it("dept empower / preview", () => {
    deptApi.empower(9, { roles: [1] });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/dept/9/empower",
      { params: {}, data: { roles: [1] } },
      {}
    );

    deptApi.preview(9);
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/dept/9/preview",
      { params: {}, data: {} },
      {}
    );
  });

  it("role preview / batchUpdate", () => {
    roleApi.preview("r1");
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/role/r1/preview",
      { params: {}, data: {} },
      {}
    );

    roleApi.batchUpdate([1, 2], { is_active: true });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/role/batch-update",
      {
        params: {},
        data: {
          pks: [1, 2],
          fields: { is_active: true },
          _write_marker: "batchUpdate"
        }
      },
      {}
    );
  });
});

describe("menuApi 权限码与排序", () => {
  it("permissions 透传 dry_run 载荷", () => {
    menuApi.permissions(7, { views: ["a.vue"], dry_run: true });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/menu/7/permissions",
      { params: {}, data: { views: ["a.vue"], dry_run: true } },
      {}
    );
  });

  it("rank / apiUrl", () => {
    menuApi.rank([1, 2, 3]);
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/menu/rank",
      { params: {}, data: [1, 2, 3] },
      {}
    );

    menuApi.apiUrl();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/menu/api-url",
      { params: {}, data: {} },
      {}
    );
  });
});

describe("脱敏 / 模型字段", () => {
  it("maskApi.preview", () => {
    maskApi.preview({ rule: "phone", sample: "13800000000" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/mask-rules/preview",
      { params: {}, data: { rule: "phone", sample: "13800000000" } },
      {}
    );
  });

  it("modelLabelFieldApi lookups / sync", () => {
    modelLabelFieldApi.lookups({ parent: 0 });
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/field/lookups",
      { params: { parent: 0 }, data: {} },
      {}
    );

    modelLabelFieldApi.sync();
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/field/sync",
      { params: {}, data: {} },
      {}
    );
  });
});

describe("导入导出下载中心", () => {
  it("exportRecordApi download / stats", () => {
    exportRecordApi.download(3);
    expect(autoDownloadMock).toHaveBeenLastCalledWith(
      "/api/system/exports/3/download"
    );

    exportRecordApi.stats();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/exports/stats",
      { params: {}, data: {} },
      {}
    );
  });

  it("importRecordApi download / stats", () => {
    importRecordApi.download(8);
    expect(autoDownloadMock).toHaveBeenLastCalledWith(
      "/api/system/imports/8/download"
    );

    importRecordApi.stats();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/imports/stats",
      { params: {}, data: {} },
      {}
    );
  });
});

describe("系统/用户配置失效", () => {
  it("systemConfigApi / userConfigApi invalid", () => {
    systemConfigApi.invalid(2);
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/config/system/2/invalid",
      { params: {}, data: {} },
      {}
    );

    userConfigApi.invalid(4);
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/config/user/4/invalid",
      { params: {}, data: {} },
      {}
    );
  });
});

describe("loginLogApi 强制登出", () => {
  it("logout 携带原因载荷", () => {
    loginLogApi.logout(4, { reason: "kick" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/logs/login/4/logout",
      { params: {}, data: { reason: "kick" } },
      {}
    );
  });
});
