import { afterEach, describe, expect, it, vi } from "vitest";
import { announce } from "../announcer";

const mountRegion = () => {
  const region = document.createElement("div");
  region.id = "a11y-live";
  document.body.appendChild(region);
  return region;
};

describe("announce（读屏播报）", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("把文本写入 #a11y-live 区域", () => {
    vi.useFakeTimers();
    const region = mountRegion();
    announce("保存成功");
    vi.advanceTimersByTime(60);
    expect(region.textContent).toBe("保存成功");
  });

  it("区域不存在时静默降级（不抛错）", () => {
    vi.useFakeTimers();
    expect(() => announce("无挂载点")).not.toThrow();
    vi.advanceTimersByTime(60);
  });

  it("空文本与空白文本忽略", () => {
    vi.useFakeTimers();
    const region = mountRegion();
    announce("");
    announce("   ");
    vi.advanceTimersByTime(60);
    expect(region.textContent).toBe("");
  });

  it("相同文本连续播报：先清空再写入（读屏可重复朗读）", () => {
    vi.useFakeTimers();
    const region = mountRegion();
    announce("操作失败");
    vi.advanceTimersByTime(60);
    announce("操作失败");
    // 第二次播报的同步阶段应已清空，异步阶段再写入
    expect(region.textContent).toBe("");
    vi.advanceTimersByTime(60);
    expect(region.textContent).toBe("操作失败");
  });
});
