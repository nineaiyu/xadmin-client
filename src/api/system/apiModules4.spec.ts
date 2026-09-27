import { describe, expect, it, vi } from "vitest";

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

import { credentialApi } from "./credential";
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
import { datasetApi } from "@/api/dataset/datasets";
import { searchGlobal } from "./search";
import { settingsSmsServerApi } from "./settings";
import { systemModuleApi } from "./modules";

/**
 * api/system 第四批（拆分自第一批超长文件）：凭据、Webhook、文件、看板与平台配置域的
 * 契约测试，口径同第一批——逐方法断言「方法 + URL + 载荷」。
 */

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
      "/api/dataset/datasets/meta",
      { params: {}, data: {} },
      {}
    );

    datasetApi.execute("ds1", { params: { limit: 10 } });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/dataset/datasets/ds1/execute",
      { params: {}, data: { params: { limit: 10 } } },
      {}
    );

    datasetApi.aggregate("ds1", { type: "sum" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/dataset/datasets/ds1/aggregate",
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
