import { describe, expect, it } from "vitest";
import {
  resolveScreenFrame,
  type ScreenControlState
} from "@/views/analysis/screen/utils/control";

/** 大屏展示端控制帧内核：模式/页码对齐与 refresh 去重 */

const AUTO: ScreenControlState = { mode: "auto", refreshRev: 0 };
const MANUAL: ScreenControlState = { mode: "manual", refreshRev: 3 };

describe("resolveScreenFrame", () => {
  it("state 回放只对齐模式与代数，不触发重拉", () => {
    const effect = resolveScreenFrame(MANUAL, {
      command: "state",
      mode: "auto",
      index: 1,
      refresh_rev: 5
    });
    expect(effect).toEqual({
      mode: "auto",
      serverIndex: 1,
      refresh: false,
      refreshRev: 5
    });
  });

  it("switch / page 切换为 manual 并给出服务端页码", () => {
    expect(
      resolveScreenFrame(AUTO, {
        command: "switch",
        mode: "manual",
        index: 2
      })
    ).toMatchObject({ mode: "manual", serverIndex: 2, refresh: false });
    expect(
      resolveScreenFrame(MANUAL, { command: "page", mode: "manual", index: 0 })
    ).toMatchObject({ mode: "manual", serverIndex: 0, refresh: false });
  });

  it("auto 恢复轮播且不改动页码", () => {
    const effect = resolveScreenFrame(MANUAL, {
      command: "auto",
      mode: "auto",
      index: 2
    });
    expect(effect).toMatchObject({
      mode: "auto",
      serverIndex: 2,
      refresh: false
    });
    expect(effect.refreshRev).toBe(MANUAL.refreshRev);
  });

  it("refresh 仅在代数递增时触发重拉（重复帧/回放不重复请求）", () => {
    const first = resolveScreenFrame(MANUAL, {
      command: "refresh",
      mode: "manual",
      refresh_rev: 4
    });
    expect(first).toMatchObject({ refresh: true, refreshRev: 4 });
    const replay = resolveScreenFrame(
      { mode: first.mode, refreshRev: first.refreshRev },
      { command: "refresh", mode: "manual", refresh_rev: 4 }
    );
    expect(replay).toMatchObject({ refresh: false, refreshRev: 4 });
  });

  it("非法/缺失页码不改变当前页，非法模式沿用当前模式", () => {
    const effect = resolveScreenFrame(AUTO, {
      command: "refresh",
      refresh_rev: 1
    });
    expect(effect.serverIndex).toBeNull();
    expect(effect.mode).toBe("auto");
    expect(
      resolveScreenFrame(AUTO, { command: "page", index: -1 }).serverIndex
    ).toBeNull();
    expect(
      resolveScreenFrame(AUTO, { command: "page", index: 1.5 }).serverIndex
    ).toBeNull();
  });
});
