import { describe, expect, it, vi } from "vitest";
import { createOnlineButtons } from "./onlineButtons";

/**
 * 在线会话页按钮装配守护：
 * - 工具栏只保留页面自建的「批量强制下线」（框架默认「批量删除」由 hook 关闭，
 *   两条同效入口并存会让操作者看到「删除」口径的确认文案）；
 * - 行内「退出登录」用单会话口径的确认文案，而不是默认的「确定删除？」
 */
const build = (
  auth: {
    destroy?: boolean;
    forceLogout?: boolean;
    batchForceLogout?: boolean;
  } = { destroy: true, forceLogout: true, batchForceLogout: true }
) =>
  createOnlineButtons({
    t: ((key: string) => key) as never,
    api: {} as never,
    tableRef: { value: { getSelectPks: vi.fn(() => []) } } as never,
    auth
  });

describe("createOnlineButtons", () => {
  it("工具栏只有页面自建的批量强制下线", () => {
    const { tableBarButtonsProps } = build();
    const codes = (tableBarButtonsProps.value.buttons ?? []).map(
      item => item.code
    );
    expect(codes).toEqual(["batchForceLogout"]);
  });

  it("行内按钮：退出登录 + 强制下线，且按权限位显隐", () => {
    const { operationButtonsProps } = build();
    const buttons = operationButtonsProps.value.buttons ?? [];
    const codeOf = (item: (typeof buttons)[number]) => item.code;
    expect(buttons.map(codeOf)).toEqual(["delete", "forceLogout"]);

    const noPerm = build({});
    expect(
      (noPerm.operationButtonsProps.value.buttons ?? []).every(
        item => !item.show
      )
    ).toBe(true);
  });

  it("退出登录的确认文案走「退出当前会话」口径", () => {
    const { operationButtonsProps } = build();
    const deleteButton = (operationButtonsProps.value.buttons ?? []).find(
      item => item.code === "delete"
    );
    const title = deleteButton?.confirm?.title as (
      row: Record<string, unknown>
    ) => string;
    expect(title({ creator: { username: "alice" } })).toBe(
      "systemOnline.logoutConfirm"
    );
  });
});
