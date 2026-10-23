import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { buildUUIDMock } = vi.hoisted(() => ({
  buildUUIDMock: vi.fn(() => "uuid-123")
}));

vi.mock("@pureadmin/utils", () => ({
  buildUUID: buildUUIDMock
}));

import {
  downloadBlob,
  downloadTextFile,
  parseDownloadEnvelopeError,
  resolveDownloadFilename
} from "./download";

describe("resolveDownloadFilename", () => {
  beforeEach(() => {
    buildUUIDMock.mockClear();
  });

  it("解析 RFC5987 UTF-8 文件名（中文名）", () => {
    expect(
      resolveDownloadFilename({
        "content-disposition":
          "attachment; filename*=UTF-8''%E6%B5%8B%E8%AF%95.xlsx"
      })
    ).toBe("测试.xlsx");
  });

  it("解析带引号的普通 filename 并 URL 解码", () => {
    expect(
      resolveDownloadFilename({
        "content-disposition": 'attachment; filename="report%20q1.csv"'
      })
    ).toBe("report q1.csv");
  });

  it("解析不带引号的普通 filename", () => {
    expect(
      resolveDownloadFilename({
        "content-disposition": "attachment; filename=plain.log"
      })
    ).toBe("plain.log");
  });

  it("RFC5987 解码失败回退普通 filename 提取（首个 filename 段，解码失败保留原值）", () => {
    expect(
      resolveDownloadFilename({
        "content-disposition":
          "attachment; filename*=UTF-8''%ZZ.xlsx; filename=fallback.bin"
      })
    ).toBe("UTF-8%ZZ.xlsx");
  });

  it("兼容 Headers 实例（get 方法）与数组头值", () => {
    expect(
      resolveDownloadFilename({
        get: (name: string) =>
          name === "content-disposition"
            ? "attachment; filename=from-headers.txt"
            : null
      })
    ).toBe("from-headers.txt");
    expect(
      resolveDownloadFilename({
        "content-disposition": ["attachment;", "filename=from-array.txt"]
      })
    ).toBe("from-array.txt");
  });

  it("无 content-disposition 时回退随机名，fallbackType 补作扩展名", () => {
    expect(resolveDownloadFilename({ "content-disposition": null })).toBe(
      "uuid-123"
    );
    expect(resolveDownloadFilename({}, "xlsx")).toBe("uuid-123.xlsx");
    expect(resolveDownloadFilename(undefined)).toBe("uuid-123");
  });

  it("有 content-disposition 但提取失败时回退随机名", () => {
    expect(
      resolveDownloadFilename({ "content-disposition": "attachment" })
    ).toBe("uuid-123");
  });
});

describe("downloadBlob", () => {
  const originalCreate = URL.createObjectURL;

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:mock");
    URL.revokeObjectURL = vi.fn();
  });

  it("对象 URL + 锚点点击（文件名取自入参），并立即释放 URL", () => {
    const clicks: string[] = [];
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      clicks.push(`${this.download}:${this.href}`);
    };
    const blob = new Blob(["payload"], { type: "text/plain" });
    expect(downloadBlob("export.txt", blob)).toBe(true);
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
    expect(clicks).toEqual(["export.txt:blob:mock"]);
    HTMLAnchorElement.prototype.click = originalClick;
  });

  it("环境不支持对象 URL 时返回 false（不抛）", () => {
    URL.createObjectURL = vi.fn(() => {
      throw new Error("not supported");
    });
    expect(downloadBlob("export.txt", new Blob(["x"]))).toBe(false);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  afterAll(() => {
    URL.createObjectURL = originalCreate;
  });
});

describe("downloadTextFile", () => {
  const originalCreate = URL.createObjectURL;

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:mock");
    URL.revokeObjectURL = vi.fn();
  });

  it("构造 Blob 对象 URL + 锚点点击，并立即释放 URL", () => {
    const clicks: string[] = [];
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      clicks.push(`${this.download}:${this.href}`);
    };
    expect(downloadTextFile("tpl.json", '{"a":1}')).toBe(true);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
    expect(clicks).toEqual(["tpl.json:blob:mock"]);
    HTMLAnchorElement.prototype.click = originalClick;
  });

  it("环境不支持对象 URL 时返回 false（不抛）", () => {
    URL.createObjectURL = vi.fn(() => {
      throw new Error("not supported");
    });
    expect(downloadTextFile("tpl.json", "{}")).toBe(false);
  });

  afterAll(() => {
    URL.createObjectURL = originalCreate;
  });
});

describe("parseDownloadEnvelopeError", () => {
  it("识别 JSON 错误信封并返回 detail", async () => {
    const blob = new Blob(
      [JSON.stringify({ code: 1001, detail: "文件已过期" })],
      {
        type: "application/json"
      }
    );
    await expect(parseDownloadEnvelopeError(blob)).resolves.toBe("文件已过期");
  });

  it("错误信封缺 detail 时返回空串（交由调用方兜底）", async () => {
    const blob = new Blob([JSON.stringify({ code: 400 })], {
      type: "application/json; charset=utf-8"
    });
    await expect(parseDownloadEnvelopeError(blob)).resolves.toBe("");
  });

  it("正常二进制文件与非错误 JSON 不当作错误", async () => {
    await expect(
      parseDownloadEnvelopeError(
        new Blob(["xlsx"], { type: "application/octet-stream" })
      )
    ).resolves.toBeNull();
    // 未来若支持 JSON 导出：业务码 1000 或非信封结构必须原样落盘
    await expect(
      parseDownloadEnvelopeError(
        new Blob([JSON.stringify({ code: 1000, data: [] })], {
          type: "application/json"
        })
      )
    ).resolves.toBeNull();
    await expect(
      parseDownloadEnvelopeError(
        new Blob([JSON.stringify([{ id: 1 }])], { type: "application/json" })
      )
    ).resolves.toBeNull();
  });

  it("声明 JSON 但内容不可解析时按文件处理", async () => {
    await expect(
      parseDownloadEnvelopeError(
        new Blob(["not-json"], { type: "application/json" })
      )
    ).resolves.toBeNull();
    await expect(parseDownloadEnvelopeError("plain")).resolves.toBeNull();
  });
});
