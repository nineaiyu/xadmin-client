import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestMock, uploadMock, autoDownloadMock, downloadMock } = vi.hoisted(
  () => ({
    requestMock: vi.fn(),
    uploadMock: vi.fn(),
    autoDownloadMock: vi.fn(),
    downloadMock: vi.fn()
  })
);

vi.mock("@/utils/http", () => ({
  http: {
    request: requestMock,
    upload: uploadMock,
    autoDownload: autoDownloadMock,
    download: downloadMock
  }
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
import { approvalApi } from "./approval";
import { approvalRuleApi } from "./approvalRule";
import { noticeApi, noticeReadApi } from "./notice";
import { systemMsgSubscriptionApi } from "./notifications";
import { leaveApi } from "./leave";
import { credentialApi } from "./credential";
import { knowledgeApi } from "./knowledge";
import { oauthApi } from "./oauth";
import { tagApi } from "./tag";
import {
  listWebhookRows,
  webhookDeliveryApi,
  webhookSubscriptionApi
} from "./webhook";
import { systemUploadFileApi } from "./file";
import {
  getDashBoardTodayOperateTotalApi,
  getDashBoardUserActiveApi,
  getDashBoardUserLoginTrendApi,
  getDashBoardUserLoginTotalApi,
  getDashBoardUserRegisterTrendApi,
  getDashBoardUserTotalApi
} from "./dashboard";
import { datasetApi } from "./datasets";
import { searchGlobal } from "./search";
import { settingsSmsServerApi } from "./settings";
import { systemModuleApi } from "./modules";

/**
 * api/system 自定义动作薄封装的契约测试：逐方法断言「方法 + URL + 载荷」。
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
      "get",
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

describe("approvalApi 审批单动作", () => {
  beforeEach(() => requestMock.mockReset());

  it("approve / reject / cancel", () => {
    approvalApi.approve("t1");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/approvals/t1/approve",
      { params: {}, data: {} },
      {}
    );

    approvalApi.reject("t1", "不符合");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/approvals/t1/reject",
      { params: {}, data: { reason: "不符合" } },
      {}
    );

    approvalApi.cancel("t1");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/approvals/t1/cancel",
      { params: {}, data: {} },
      {}
    );
  });

  it("批量通过 / 驳回", () => {
    approvalApi.batchApprove([1, 2]);
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/approvals/batch-approve",
      { params: {}, data: { pks: [1, 2] } },
      {}
    );

    approvalApi.batchReject([3], "材料不全");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/approvals/batch-reject",
      { params: {}, data: { pks: [3], reason: "材料不全" } },
      {}
    );
  });

  it("pendingCount / stats 轻量端点", () => {
    approvalApi.pendingCount();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/approvals/pending-count",
      { params: {}, data: {} },
      {}
    );

    approvalApi.stats();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/approvals/stats",
      { params: {}, data: {} },
      {}
    );
  });

  it("approvalRuleApi candidateOptions", () => {
    approvalRuleApi.candidateOptions();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/approval-rules/candidate-options",
      { params: {}, data: {} },
      {}
    );
  });
});

describe("公告与已读", () => {
  it("noticeApi announcement / publish", () => {
    noticeApi.announcement({ title: "hi" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/notifications/notice-messages/announcement",
      { params: {}, data: { title: "hi" } },
      {}
    );

    noticeApi.publish(2, { top: 1 });
    expect(requestMock).toHaveBeenLastCalledWith(
      "patch",
      "/api/notifications/notice-messages/2/publish",
      { params: {}, data: { top: 1 } },
      {}
    );
  });

  it("noticeReadApi state", () => {
    noticeReadApi.state(3, { read: true });
    expect(requestMock).toHaveBeenLastCalledWith(
      "patch",
      "/api/notifications/user-read-messages/3/state",
      { params: {}, data: { read: true } },
      {}
    );
  });
});

describe("消息订阅", () => {
  it("backends / list / update / testMsg / partialUpdate", () => {
    systemMsgSubscriptionApi.backends();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/notifications/system-msg-subscription/backends",
      { params: {}, data: {} },
      {}
    );

    systemMsgSubscriptionApi.list({ category: "audit" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/notifications/system-msg-subscription",
      { params: { category: "audit" }, data: {} },
      {}
    );

    systemMsgSubscriptionApi.update(5, { receive_backends: ["email"] });
    expect(requestMock).toHaveBeenLastCalledWith(
      "put",
      "/api/notifications/system-msg-subscription/5",
      { params: {}, data: { receive_backends: ["email"] } },
      {}
    );

    systemMsgSubscriptionApi.testMsg({ message_type: "security" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/notifications/system-msg-subscription/test",
      { params: {}, data: { message_type: "security" } },
      {}
    );

    systemMsgSubscriptionApi.partialUpdate(5, { receive_backends: [] });
    expect(requestMock).toHaveBeenLastCalledWith(
      "patch",
      "/api/notifications/system-msg-subscription/5",
      { params: {}, data: { receive_backends: [] } },
      {}
    );
  });
});

describe("leaveApi 请假", () => {
  it("submit / cancel / stats", () => {
    leaveApi.submit("lv1");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/leaves/lv1/submit",
      { params: {}, data: {} },
      {}
    );

    leaveApi.cancel("lv1");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/leaves/lv1/cancel",
      { params: {}, data: {} },
      {}
    );

    leaveApi.stats();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/leaves/stats",
      { params: {}, data: {} },
      {}
    );
  });
});

describe("credentialApi 凭据", () => {
  it("overview / rotate", () => {
    credentialApi.overview();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/credentials/overview",
      { params: {}, data: {} },
      {}
    );

    credentialApi.rotate({ key: "JWT_SIGNING_KEY" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/credentials/rotate",
      { params: {}, data: { key: "JWT_SIGNING_KEY" } },
      {}
    );
  });
});

describe("knowledgeApi 知识库", () => {
  it("upload 落在资源根端点", () => {
    knowledgeApi.upload("手册", "# 内容");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/ai/knowledge-documents",
      { params: {}, data: { name: "手册", content: "# 内容" } },
      {}
    );
  });

  it("syncRepo / batchToggle", () => {
    knowledgeApi.syncRepo();
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/ai/knowledge-documents/sync-repo",
      { params: {}, data: {} },
      {}
    );

    knowledgeApi.batchToggle([1, 2], false);
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/ai/knowledge-documents/batch-toggle",
      { params: {}, data: { pks: [1, 2], is_active: false } },
      {}
    );
  });
});

describe("oauthApi 第三方登录", () => {
  it("providers / authorize / callback", () => {
    oauthApi.providers();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/auth/oauth/providers",
      { params: {}, data: {} },
      {}
    );

    oauthApi.authorize("github");
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/auth/oauth/github/authorize",
      { params: {}, data: {} },
      {}
    );

    oauthApi.callback("github", { code: "c", state: "s" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/auth/oauth/github/callback",
      { params: { code: "c", state: "s" }, data: {} },
      {}
    );
  });

  it("绑定：bindAuthorize / bindings / unbind", () => {
    oauthApi.bindAuthorize("github");
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/auth/oauth/github/bind-authorize",
      { params: {}, data: {} },
      {}
    );

    oauthApi.bindings();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/auth/oauth/bindings",
      { params: {}, data: {} },
      {}
    );

    oauthApi.unbind("b1", "pw");
    expect(requestMock).toHaveBeenLastCalledWith(
      "delete",
      "/api/system/auth/oauth/bindings/b1",
      { params: {}, data: { password: "pw" } },
      {}
    );
  });
});

describe("tagApi 标签中心", () => {
  it("getResources / getObjectTags", () => {
    tagApi.getResources();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/tags/resources",
      { params: {}, data: {} },
      {}
    );

    tagApi.getObjectTags("file", "9");
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/tags/objects",
      { params: { resource: "file", pk: "9" }, data: {} },
      {}
    );
  });

  it("assign / batchAssign 全量替换与批量模式", () => {
    tagApi.assign({ resource: "file", pk: "9", tags: ["t1"] });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/tags/assign",
      { params: {}, data: { resource: "file", pk: "9", tags: ["t1"] } },
      {}
    );

    tagApi.batchAssign({
      resource: "file",
      pks: ["1"],
      tags: ["t2"],
      mode: "add"
    });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/tags/batch-assign",
      {
        params: {},
        data: { resource: "file", pks: ["1"], tags: ["t2"], mode: "add" }
      },
      {}
    );
  });
});

describe("webhook 订阅与投递", () => {
  it("events / test / retry", () => {
    webhookSubscriptionApi.events();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/webhooks/subscriptions/events",
      { params: {}, data: {} },
      {}
    );

    webhookSubscriptionApi.test("w1");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/webhooks/subscriptions/w1/test",
      { params: {}, data: {} },
      {}
    );

    webhookDeliveryApi.retry("d1");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/webhooks/deliveries/d1/retry",
      { params: {}, data: {} },
      {}
    );
  });

  it("listWebhookRows 拆包壳数据，空壳返回空数组", () => {
    expect(listWebhookRows({ data: { results: [{ pk: "1" }] } })).toEqual([
      { pk: "1" }
    ]);
    expect(listWebhookRows(null)).toEqual([]);
  });
});

describe("systemUploadFileApi 文件", () => {
  it("download 走鉴权下载", () => {
    systemUploadFileApi.download(12, "a.png");
    expect(autoDownloadMock).toHaveBeenLastCalledWith(
      "/api/system/file/12/download",
      "a.png"
    );
  });

  it("accessLogs / config / stats", () => {
    systemUploadFileApi.accessLogs(12);
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/file/12/access-logs",
      { params: {}, data: {} },
      {}
    );

    systemUploadFileApi.config({ scope: "user" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/file/config",
      { params: { scope: "user" }, data: {} },
      {}
    );

    systemUploadFileApi.stats();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/file/stats",
      { params: {}, data: {} },
      {}
    );
  });

  it("upload / preview 走 http 专用通道", () => {
    systemUploadFileApi.upload({ name: "f" });
    expect(uploadMock).toHaveBeenLastCalledWith(
      "/api/system/file/upload",
      {},
      { name: "f" },
      undefined
    );

    systemUploadFileApi.preview(12, { kind: "text" });
    expect(downloadMock).toHaveBeenLastCalledWith(
      "/api/system/file/12/preview",
      { kind: "text" }
    );
  });
});

describe("dashboard 统计端点", () => {
  it("六个统计函数的 URL 与查询透传", () => {
    getDashBoardUserLoginTotalApi({ days: 7 });
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/dashboard/user-login-total",
      { params: { days: 7 } }
    );

    getDashBoardUserTotalApi();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/dashboard/user-total",
      { params: undefined }
    );

    getDashBoardUserRegisterTrendApi({ days: 30 });
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/dashboard/user-registered-trend",
      { params: { days: 30 } }
    );

    getDashBoardUserLoginTrendApi();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/dashboard/user-login-trend",
      { params: undefined }
    );

    getDashBoardUserActiveApi();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/dashboard/user-active",
      { params: undefined }
    );

    getDashBoardTodayOperateTotalApi();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/dashboard/today-operate-total",
      { params: undefined }
    );
  });
});

describe("datasets 数据集动作", () => {
  it("meta / execute / aggregate", () => {
    datasetApi.meta();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/datasets/meta",
      { params: {}, data: {} },
      {}
    );

    datasetApi.execute("ds1", { params: { limit: 10 } });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/datasets/ds1/execute",
      { params: {}, data: { params: { limit: 10 } } },
      {}
    );

    datasetApi.aggregate("ds1", { type: "sum" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/datasets/ds1/aggregate",
      { params: {}, data: { type: "sum" } },
      {}
    );
  });
});

describe("search 全局搜索", () => {
  it("searchGlobal 仅关键词 / 带范围", () => {
    searchGlobal("张三");
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/global-search",
      { params: { keyword: "张三" }, data: {} },
      {}
    );

    searchGlobal("张三", "user");
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/global-search",
      { params: { keyword: "张三", scope: "user" }, data: {} },
      {}
    );
  });
});

describe("settings 短信后端", () => {
  it("backends 端点", () => {
    settingsSmsServerApi.backends({ scope: "diagnose" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/settings/sms/backends",
      { params: { scope: "diagnose" }, data: {} },
      {}
    );
  });
});

describe("systemModuleApi 模块清单", () => {
  it("list / apply / reset", () => {
    systemModuleApi.list();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/modules",
      { params: {}, data: {} },
      {}
    );

    systemModuleApi.apply({ preset: "full", enable: ["chat"], disable: [] });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/modules/apply",
      {
        params: {},
        data: { preset: "full", enable: ["chat"], disable: [] }
      },
      {}
    );

    systemModuleApi.reset();
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/modules/reset",
      { params: {}, data: {} },
      {}
    );
  });
});
