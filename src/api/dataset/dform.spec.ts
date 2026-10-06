import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestMock } = vi.hoisted(() => ({
  requestMock: vi.fn()
}));

vi.mock("@/utils/http", () => ({
  http: {
    request: requestMock,
    upload: vi.fn(),
    autoDownload: vi.fn(),
    download: vi.fn()
  }
}));

import { http } from "@/utils/http";
import {
  designerApi,
  dynamicFormApi,
  formDataApi,
  submissionApi
} from "./dform";

/**
 * api/dataset 动态表单契约测试：表单定义标准 CRUD 基址 + 提交侧动作
 * （选人候选 / 重新提交 / 草稿提交载荷包裹 / 可填报表单）+ 表单数据页
 * 请求参数注入（表单 / 物化筛选 / 动态列收缩）。
 */

describe("dynamicFormApi 表单定义", () => {
  beforeEach(() => {
    requestMock.mockClear();
  });

  it("基址与 BaseApi 标准 CRUD（list / create / retrieve）", () => {
    expect(dynamicFormApi.baseApi).toBe("/api/dataset/dynamic-forms");
    dynamicFormApi.list({ page: 1 });
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/dataset/dynamic-forms",
      {
        params: { page: 1 },
        data: {}
      },
      {}
    );
    dynamicFormApi.create({ name: "报销单", schema: { fields: [] } });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/dataset/dynamic-forms",
      { params: {}, data: { name: "报销单", schema: { fields: [] } } },
      {}
    );
    dynamicFormApi.retrieve("f1");
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/dataset/dynamic-forms/f1",
      { params: {}, data: {} },
      {}
    );
  });

  it("designerApi.retrieveForm 按主键取表单定义全文（编辑 / 模板复用取原文）", () => {
    designerApi.retrieveForm("f1");
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/dataset/dynamic-forms/f1",
      { params: {}, data: {} },
      {}
    );
  });
});

describe("submissionApi 填报与提交", () => {
  beforeEach(() => {
    requestMock.mockClear();
  });

  it("userOptions：keyword / pks 逗号拼接 / 双参", () => {
    submissionApi.userOptions({ keyword: "李" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/dataset/dynamic-form-submissions/user-options",
      { params: { keyword: "李" }, data: {} },
      {}
    );
    submissionApi.userOptions({ pks: [4, 5] });
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/dataset/dynamic-form-submissions/user-options",
      { params: { pks: "4,5" }, data: {} },
      {}
    );
    submissionApi.userOptions({ keyword: "李", pks: [4] });
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/dataset/dynamic-form-submissions/user-options",
      { params: { keyword: "李", pks: "4" }, data: {} },
      {}
    );
  });

  it("resubmit 仅带主键的动作端点", () => {
    submissionApi.resubmit("s1");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/dataset/dynamic-form-submissions/s1/resubmit",
      { params: {}, data: {} },
      {}
    );
  });

  it("submit 有数据时包裹在 data 键下，无数据时空载荷", () => {
    submissionApi.submit("s1", { amount: 100, reason: "差旅" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/dataset/dynamic-form-submissions/s1/submit",
      { params: {}, data: { data: { amount: 100, reason: "差旅" } } },
      {}
    );
    submissionApi.submit("s1");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/dataset/dynamic-form-submissions/s1/submit",
      { params: {}, data: {} },
      {}
    );
  });

  it("availableForms 为填报页数据源", () => {
    submissionApi.availableForms();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/dataset/dynamic-form-submissions/available-forms",
      { params: {}, data: {} },
      {}
    );
  });
});

describe("formDataApi 表单数据（管理端）", () => {
  beforeEach(() => {
    requestMock.mockClear();
    formDataApi.form = "";
    formDataApi.filterData = "";
    formDataApi.dataFields = "";
  });

  it("list 自动携带页面侧参数（表单 / 物化筛选 / 动态列收缩）", () => {
    formDataApi.form = "f1";
    formDataApi.filterData = '{"level":"P5"}';
    formDataApi.dataFields = "kind,reason";
    formDataApi.list({ page: 1 });
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/dataset/form-data",
      {
        params: {
          page: 1,
          form: "f1",
          filter_data: '{"level":"P5"}',
          data_fields: "kind,reason"
        },
        data: {}
      },
      {}
    );
  });

  it("exportData 下载参数同样携带页面侧参数", () => {
    formDataApi.form = "f1";
    formDataApi.dataFields = "kind,reason";
    formDataApi.exportData({ type: "csv" });
    expect(http.autoDownload).toHaveBeenLastCalledWith(
      "/api/dataset/form-data/export-data",
      undefined,
      { type: "csv", form: "f1", data_fields: "kind,reason" }
    );
  });

  it("页面侧参数缺省时不占用查询串", () => {
    formDataApi.list();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/dataset/form-data",
      { params: {}, data: {} },
      {}
    );
  });
});
