import { describe, expect, it } from "vitest";

import { buildImageStyle, resolveImageQuality } from "../src/utils";

const canvas = (width: number, height: number) =>
  ({ width, height }) as HTMLCanvasElement;

describe("ReCropper 纯逻辑", () => {
  it("quality 显式传入时不改写 type/quality", () => {
    expect(resolveImageQuality(canvas(100, 100), 0.8, "image/webp")).toEqual({
      quality: 0.8,
      type: "image/webp"
    });
  });

  it("quality=0 按像素量选择压缩档（越大越狠）", () => {
    expect(resolveImageQuality(canvas(100, 100), 0, "image/png")).toEqual({
      quality: 1,
      type: "image/png"
    });
    const medium = resolveImageQuality(canvas(800, 800), 0, "image/png");
    expect(medium.type).toBe("image/jpeg");
    expect(medium.quality).toBeLessThan(1);
    const huge = resolveImageQuality(canvas(4000, 4000), 0, "image/png");
    expect(huge.quality).toBe(0.2);
  });

  it("图片样式保留高度并叠加调用方覆盖", () => {
    expect(
      buildImageStyle(120, { maxWidth: "50%", objectFit: "cover" })
    ).toMatchObject({ height: 120, maxWidth: "50%", objectFit: "cover" });
  });
});
