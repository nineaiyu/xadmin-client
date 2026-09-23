import { describe, expect, it } from "vitest";
import {
  buildZipStore,
  crc32,
  dataUrlToBytes,
  safeFileName
} from "@/utils/imageExport";

describe("crc32", () => {
  it("matches the canonical check value", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("returns 0 for empty input", () => {
    expect(crc32(new Uint8Array([]))).toBe(0);
  });
});

describe("buildZipStore", () => {
  it("writes a valid store-mode zip container", async () => {
    const files = [
      { name: "a.png", data: new Uint8Array([1, 2, 3]) },
      { name: "b.png", data: new Uint8Array([4, 5]) }
    ];
    const blob = buildZipStore(files);
    expect(blob.type).toBe("application/zip");

    const buffer = await blob.arrayBuffer();
    const view = new DataView(buffer);
    // local file header 签名
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    // 第一个条目的 CRC / 大小 / 名称（UTF-8）
    expect(view.getUint32(14, true)).toBe(crc32(files[0].data));
    expect(view.getUint32(18, true)).toBe(3);
    expect(new TextDecoder().decode(new Uint8Array(buffer, 30, 5))).toBe(
      "a.png"
    );

    // EOCD 位于末尾 22 字节，条目数与中央目录偏移可读
    const eocdOffset = buffer.byteLength - 22;
    expect(view.getUint32(eocdOffset, true)).toBe(0x06054b50);
    expect(view.getUint16(eocdOffset + 8, true)).toBe(2);
    expect(view.getUint16(eocdOffset + 10, true)).toBe(2);
    const centralSize = view.getUint32(eocdOffset + 12, true);
    const centralOffset = view.getUint32(eocdOffset + 16, true);
    // 中央目录起点 = 两个 local 条目之后
    // （第一条 30+5+3=38，第二条 30+5+2=37 → 75）
    expect(centralOffset).toBe(75);
    // 中央目录签名
    expect(view.getUint32(centralOffset, true)).toBe(0x02014b50);
    // 中央目录 + EOCD 恰好构成文件尾部
    expect(centralOffset + centralSize).toBe(eocdOffset);
  });
});

describe("dataUrlToBytes", () => {
  it("decodes base64 payload after the comma", () => {
    expect(Array.from(dataUrlToBytes("data:image/png;base64,AQID"))).toEqual([
      1, 2, 3
    ]);
  });
});

describe("safeFileName", () => {
  it("strips path separators and collapses whitespace", () => {
    expect(safeFileName("仪表盘/销售 趋势*图")).toBe("仪表盘-销售-趋势-图");
  });

  it("falls back when the name becomes empty", () => {
    expect(safeFileName("   ", "chart")).toBe("chart");
  });

  it("truncates extremely long names", () => {
    expect(safeFileName("x".repeat(200)).length).toBe(80);
  });
});
