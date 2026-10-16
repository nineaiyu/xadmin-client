import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestMock, fetchAllRowsMock } = vi.hoisted(() => ({
  requestMock: vi.fn(),
  fetchAllRowsMock: vi.fn()
}));

vi.mock("@/utils/http", () => ({
  http: {
    request: requestMock,
    upload: vi.fn(),
    autoDownload: vi.fn(),
    download: vi.fn()
  }
}));

vi.mock("@/utils/fetchAllRows", () => ({
  fetchAllRows: fetchAllRowsMock
}));

import {
  getScreenCommandState,
  listDashboards,
  relatedPk,
  reportApi,
  runReport,
  screenApi,
  searchReportUsers,
  sendScreenCommand
} from "./analysis";

/**
 * api/dataset 大屏与定时报表契约测试：控制态端点、指令载荷、报表动作、
 * 关联字段取主键的两种形态兼容（{pk,label} 对象 / 纯 pk 字符串）。
 */

describe("大屏控制（ws_screen 落态协议）", () => {
  beforeEach(() => {
    requestMock.mockClear();
    fetchAllRowsMock.mockReset();
  });

  it("getScreenCommandState 读取控制态 + 仪表盘清单", () => {
    getScreenCommandState("s1");
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/dataset/screens/s1/command",
      { params: {}, data: {} },
      {}
    );
  });

  it("sendScreenCommand 下发指令载荷原样透传", () => {
    const payload = { command: "switch", dashboard_pk: "d1" } as const;
    sendScreenCommand("s1", payload);
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/dataset/screens/s1/command",
      { params: {}, data: payload },
      {}
    );
    sendScreenCommand("s1", { command: "page", index: 2 });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/dataset/screens/s1/command",
      { params: {}, data: { command: "page", index: 2 } },
      {}
    );
  });

  it("screenApi / reportApi 基址与 BaseApi 标准 CRUD（choices 示例）", () => {
    expect(screenApi.baseApi).toBe("/api/dataset/screens");
    expect(reportApi.baseApi).toBe("/api/dataset/reports");
    reportApi.choices();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/dataset/reports/choices",
      { params: {}, data: {} },
      {}
    );
  });
});

describe("定时报表", () => {
  beforeEach(() => {
    requestMock.mockClear();
    fetchAllRowsMock.mockReset();
  });

  it("searchReportUsers：keyword / pks 逗号拼接 / 双参 / 全空", () => {
    searchReportUsers({ keyword: "张" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/dataset/reports/user-options",
      { params: { keyword: "张" }, data: {} },
      {}
    );
    searchReportUsers({ pks: [1, 2, 3] });
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/dataset/reports/user-options",
      { params: { pks: "1,2,3" }, data: {} },
      {}
    );
    searchReportUsers({ keyword: "张", pks: [9] });
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/dataset/reports/user-options",
      { params: { keyword: "张", pks: "9" }, data: {} },
      {}
    );
    searchReportUsers({});
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/dataset/reports/user-options",
      { params: {}, data: {} },
      {}
    );
  });

  it("runReport 触发立即运行并返回下载中心产物", () => {
    runReport("r1");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/dataset/reports/r1/run",
      { params: {}, data: {} },
      {}
    );
  });

  it("listDashboards 经 fetchAllRows 逐页拉全后解包行", async () => {
    const rows = [{ pk: "d1", name: "销售看板" }];
    fetchAllRowsMock.mockResolvedValue({ data: { results: rows } });
    await expect(listDashboards()).resolves.toEqual(rows);
    expect(fetchAllRowsMock).toHaveBeenCalledTimes(1);
  });

  it("relatedPk 兼容对象 / 字符串 / 空值三种历史形态", () => {
    expect(relatedPk({ pk: "p1", label: "名称" })).toBe("p1");
    expect(relatedPk("raw-pk")).toBe("raw-pk");
    expect(relatedPk(null)).toBe("");
    expect(relatedPk(undefined)).toBe("");
  });
});
