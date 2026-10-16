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

  it("把文本写入 #a11y-live 区域，读完后清空文本但保留容器", () => {
    vi.useFakeTimers();
    const region = mountRegion();
    announce("保存成功");
    vi.advanceTimersByTime(60);
    expect(region.textContent).toBe("保存成功");
    // 驻留时长按文本长度自适应（读屏朗读需要时间），到期后清空文本
    vi.advanceTimersByTime(9000);
    expect(region.textContent).toBe("");
    // 容器（live region）必须常驻可访问性树，否则后续播报全部失效
    expect(document.getElementById("a11y-live")).not.toBeNull();
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

  it("连续播报不同文本：前一条的定时器不写回、也不提前清空新文案", () => {
    vi.useFakeTimers();
    const region = mountRegion();
    announce("第一条");
    vi.advanceTimersByTime(60); // t=60：写入「第一条」，其清空定时器落在 t=1440
    announce("第二条");
    vi.advanceTimersByTime(60); // t=120：写入「第二条」，其清空定时器落在 t=1500
    expect(region.textContent).toBe("第二条");
    // 推进到「第一条」清空点之后、「第二条」清空点之前：
    // 若旧定时器未被撤销，此处文案会被旧定时器清掉
    vi.advanceTimersByTime(1340); // t=1460
    expect(region.textContent).toBe("第二条");
  });
});
