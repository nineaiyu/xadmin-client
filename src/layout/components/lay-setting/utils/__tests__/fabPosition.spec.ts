import { beforeEach, describe, expect, it, vi } from "vitest";

// 命名空间来自运行时配置（平台配置加载后才可用），单测里固定为测试前缀
vi.mock("@/config", () => ({
  responsiveStorageNameSpace: () => "responsive-"
}));

import {
  FAB_MARGIN,
  FAB_SIZE,
  clampFabPosition,
  readFabPosition,
  writeFabPosition
} from "../fabPosition";

const VIEWPORT = { width: 1280, height: 800 };
const STORAGE_KEY = "responsive-preferences-fab-position";

describe("clampFabPosition", () => {
  it("视口内的位置原样保留", () => {
    expect(clampFabPosition({ x: 400, y: 300 }, VIEWPORT)).toEqual({
      x: 400,
      y: 300
    });
  });

  it("越界位置拉回留白内的可抓取区域", () => {
    expect(clampFabPosition({ x: -200, y: -200 }, VIEWPORT)).toEqual({
      x: FAB_MARGIN,
      y: FAB_MARGIN
    });
    expect(clampFabPosition({ x: 9999, y: 9999 }, VIEWPORT)).toEqual({
      x: VIEWPORT.width - FAB_SIZE - FAB_MARGIN,
      y: VIEWPORT.height - FAB_SIZE - FAB_MARGIN
    });
  });

  it("视口小于球体时退化为左上留白（不产生负值）", () => {
    expect(
      clampFabPosition({ x: 100, y: 100 }, { width: 40, height: 40 })
    ).toEqual({ x: FAB_MARGIN, y: FAB_MARGIN });
  });
});

describe("悬浮球位置的持久化", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("无记录时返回 null（回落默认右下角）", () => {
    expect(readFabPosition()).toBeNull();
  });

  it("写入后可原样读回", () => {
    writeFabPosition({ x: 120, y: 240 });
    expect(readFabPosition()).toEqual({ x: 120, y: 240 });
    expect(localStorage.getItem(STORAGE_KEY)).toBe(
      JSON.stringify({ x: 120, y: 240 })
    );
  });

  it("写 null 清除记录（恢复默认角落）", () => {
    writeFabPosition({ x: 10, y: 10 });
    writeFabPosition(null);
    expect(readFabPosition()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("字段缺失或非法 JSON 时按无记录处理（不抛错）", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ x: 10 }));
    expect(readFabPosition()).toBeNull();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ x: "a", y: 0 }));
    expect(readFabPosition()).toBeNull();
    localStorage.setItem(STORAGE_KEY, "{oops");
    expect(readFabPosition()).toBeNull();
  });
});
