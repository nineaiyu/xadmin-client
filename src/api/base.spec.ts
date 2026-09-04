import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestMock, uploadMock, autoDownloadMock } = vi.hoisted(() => ({
  requestMock: vi.fn(),
  uploadMock: vi.fn(),
  autoDownloadMock: vi.fn()
}));

vi.mock("@/utils/http", () => ({
  http: {
    request: requestMock,
    upload: uploadMock,
    autoDownload: autoDownloadMock
  }
}));

import { BaseApi, BaseRequest, ViewBaseApi } from "./base";

describe("BaseRequest.formatParams", () => {
  it("过滤空字符串，保留 0 / false / null 等有效值", () => {
    const req = new BaseRequest("/api/demo/book");
    expect(
      req.formatParams({ name: "x", phone: "", gender: 0, flag: false })
    ).toEqual({
      name: "x",
      gender: 0,
      flag: false
    });
  });

  it("undefined 入参返回空对象", () => {
    const req = new BaseRequest("/api/demo/book");
    expect(req.formatParams(undefined)).toEqual({});
  });
});

describe("BaseApi 请求形态", () => {
  let api: BaseApi;

  beforeEach(() => {
    api = new BaseApi("/api/demo/book");
    requestMock.mockReset();
  });

  it("list 使用 GET 并过滤空查询参数", () => {
    api.list({ name: "", page: 2 });
    expect(requestMock).toHaveBeenCalledWith(
      "get",
      "/api/demo/book",
      expect.objectContaining({ params: { page: 2 } }),
      {}
    );
  });

  it("create 使用 POST 并透传 data", () => {
    api.create({ name: "新书" });
    expect(requestMock).toHaveBeenCalledWith(
      "post",
      "/api/demo/book",
      expect.objectContaining({ data: { name: "新书" } }),
      {}
    );
  });

  it("retrieve / update / partialUpdate / destroy 拼接 pk", () => {
    api.retrieve("pk-1", { expand: 1 });
    expect(requestMock).toHaveBeenCalledWith(
      "get",
      "/api/demo/book/pk-1",
      expect.objectContaining({ params: { expand: 1 } }),
      {}
    );

    api.update("pk-1", { name: "改" });
    expect(requestMock).toHaveBeenCalledWith(
      "put",
      "/api/demo/book/pk-1",
      expect.objectContaining({ data: { name: "改" } }),
      {}
    );

    api.partialUpdate("pk-1", { name: "改" });
    expect(requestMock).toHaveBeenCalledWith(
      "patch",
      "/api/demo/book/pk-1",
      expect.objectContaining({ data: { name: "改" } }),
      {}
    );

    api.destroy("pk-1", { hard: 1 });
    expect(requestMock).toHaveBeenCalledWith(
      "delete",
      "/api/demo/book/pk-1",
      expect.objectContaining({ params: { hard: 1 } }),
      {}
    );
  });

  it("batchDestroy 使用 POST /batch-destroy 并传 pks 数组", () => {
    api.batchDestroy(["a", "b"]);
    expect(requestMock).toHaveBeenCalledWith(
      "post",
      "/api/demo/book/batch-destroy",
      expect.objectContaining({ data: ["a", "b"] }),
      {}
    );
  });

  it("choices / fields / columns 使用 GET", () => {
    api.choices();
    expect(requestMock).toHaveBeenCalledWith(
      "get",
      "/api/demo/book/choices",
      expect.anything(),
      {}
    );

    api.fields({ name: "x" });
    expect(requestMock).toHaveBeenCalledWith(
      "get",
      "/api/demo/book/search-fields",
      expect.anything(),
      {}
    );

    api.columns();
    expect(requestMock).toHaveBeenCalledWith(
      "get",
      "/api/demo/book/search-columns",
      expect.anything(),
      {}
    );
  });
});

describe("BaseApi 文件上传分支", () => {
  let api: BaseApi;

  beforeEach(() => {
    api = new BaseApi("/api/demo/book");
    requestMock.mockReset();
  });

  it("data 含单个 File 时设置 multipart/form-data", () => {
    const file = new File(["x"], "a.png", { type: "image/png" });
    api.create({ file });
    const [, , , config] = requestMock.mock.calls[0];
    expect(config.headers["Content-Type"]).toBe("multipart/form-data");
  });

  it("data 含 File 数组时设置 multipart/form-data", () => {
    const file = new File(["x"], "a.png", { type: "image/png" });
    api.create({ files: [file] });
    const [, , , config] = requestMock.mock.calls[0];
    expect(config.headers["Content-Type"]).toBe("multipart/form-data");
  });

  it("无文件时不强制 multipart", () => {
    api.create({ name: "普通" });
    const [, , , config] = requestMock.mock.calls[0];
    expect(config.headers).toBeUndefined();
  });
});

describe("BaseApi 导出 / 导入", () => {
  let api: BaseApi;

  beforeEach(() => {
    api = new BaseApi("/api/demo/book");
    autoDownloadMock.mockReset();
    uploadMock.mockReset();
  });

  it("exportData 走 autoDownload 且过滤空参数", () => {
    api.exportData({ name: "x", empty: "" });
    expect(autoDownloadMock).toHaveBeenCalledWith(
      "/api/demo/book/export-data",
      null,
      {
        name: "x"
      }
    );
  });

  it("importData 走 upload 并区分 csv / xlsx Content-Type", () => {
    const csv = new File([""], "a.csv", { type: "text/csv" });
    api.importData({}, csv);
    expect(uploadMock).toHaveBeenCalledWith(
      "/api/demo/book/import-data",
      {},
      csv,
      expect.objectContaining({ headers: { "Content-Type": "text/csv" } })
    );

    const xlsx = new File([""], "a.xlsx", { type: "application/vnd.ms-excel" });
    api.importData({}, xlsx);
    expect(uploadMock).toHaveBeenCalledWith(
      "/api/demo/book/import-data",
      {},
      xlsx,
      expect.objectContaining({ headers: { "Content-Type": "text/xlsx" } })
    );
  });
});

describe("ViewBaseApi 参数形态", () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  it("create/update/partialUpdate 将 params 直接透传，URL 不拼 pk", () => {
    const api = new ViewBaseApi("/api/demo/view");
    api.create({ expand: 1 }, { name: "x" });
    expect(requestMock).toHaveBeenCalledWith(
      "post",
      "/api/demo/view",
      expect.objectContaining({ params: { expand: 1 }, data: { name: "x" } }),
      {}
    );

    api.update({ id: 1 }, { name: "y" });
    expect(requestMock).toHaveBeenCalledWith(
      "put",
      "/api/demo/view",
      expect.objectContaining({ params: { id: 1 }, data: { name: "y" } }),
      {}
    );

    api.partialUpdate({ id: 1 }, { name: "z" });
    expect(requestMock).toHaveBeenCalledWith(
      "patch",
      "/api/demo/view",
      expect.objectContaining({ params: { id: 1 }, data: { name: "z" } }),
      {}
    );
  });

  it("columns 使用 GET /search-columns", () => {
    const api = new ViewBaseApi("/api/demo/view");
    api.columns();
    expect(requestMock).toHaveBeenCalledWith(
      "get",
      "/api/demo/view/search-columns",
      expect.anything(),
      {}
    );
  });
});
