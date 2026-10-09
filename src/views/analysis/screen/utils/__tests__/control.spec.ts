import { describe, expect, it } from "vitest";
import { MessageAction } from "@/utils/websocket/protocol";
import {
  localIndexToServer,
  resolveScreenFrame,
  resolveScreenInbound,
  serverIndexToLocal,
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

describe("服务端/本地可见列表下标互映", () => {
  // 服务端原序含浏览者不可见的 d-hidden，本地列表是过滤子集
  const server = ["d-hidden", "d1", "d2"];
  const visible = [{ pk: "d1" }, { pk: "d2" }];

  it("服务端下标按 pk 映射，跳过不可见项不错位", () => {
    expect(serverIndexToLocal(server, visible, 1)).toBe(0);
    expect(serverIndexToLocal(server, visible, 2)).toBe(1);
  });

  it("不可见项/越界下标返回 null（调用方保持当前页）", () => {
    expect(serverIndexToLocal(server, visible, 0)).toBeNull();
    expect(serverIndexToLocal(server, visible, 9)).toBeNull();
  });

  it("本地下标反查服务端原序；无所属返回 -1（勿上报）", () => {
    expect(localIndexToServer(server, visible, 0)).toBe(1);
    expect(localIndexToServer(server, visible, 1)).toBe(2);
    expect(localIndexToServer(server, visible, 9)).toBe(-1);
    expect(localIndexToServer(server, [{ pk: "d-missing" }], 0)).toBe(-1);
  });
});

describe("resolveScreenInbound", () => {
  it("只认业务码成功且有载荷的 screen_data / screen_command 帧", () => {
    const data = resolveScreenInbound({
      action: MessageAction.SCREEN_DATA,
      code: 1000,
      data: { cards: [] }
    });
    expect(data).toMatchObject({ kind: "data" });
    const command = resolveScreenInbound({
      action: MessageAction.SCREEN_COMMAND,
      code: 1000,
      data: { command: "page", mode: "manual", index: 1 }
    });
    expect(command).toMatchObject({ kind: "command" });
  });

  it("其它通道帧 / 失败帧 / 空载荷一律 null（调用方跳过）", () => {
    expect(
      resolveScreenInbound({
        action: MessageAction.CHAT_MESSAGE,
        code: 1000,
        data: {}
      })
    ).toBeNull();
    expect(
      resolveScreenInbound({
        action: MessageAction.SCREEN_COMMAND,
        code: 1001,
        data: {}
      })
    ).toBeNull();
    expect(
      resolveScreenInbound({ action: MessageAction.SCREEN_DATA, code: 1000 })
    ).toBeNull();
  });
});
