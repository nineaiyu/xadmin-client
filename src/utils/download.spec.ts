import { beforeEach, describe, expect, it, vi } from "vitest";

const { buildUUIDMock } = vi.hoisted(() => ({
  buildUUIDMock: vi.fn(() => "uuid-123")
}));

vi.mock("@pureadmin/utils", () => ({
  buildUUID: buildUUIDMock
}));

import { resolveDownloadFilename } from "./download";

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
