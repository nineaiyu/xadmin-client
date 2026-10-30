import { describe, expect, it, vi } from "vitest";
import { useAiProfileButtons } from "../useAiProfileButtons";

const t = ((key: string) => key) as never;

const setup = (canManage: boolean) =>
  useAiProfileButtons({
    t,
    flags: {
      canCreate: false,
      canActivate: false,
      canDeactivate: false,
      canTest: false,
      canManage
    },
    activate: vi.fn(),
    deactivate: vi.fn(),
    testProfile: vi.fn(),
    openDialog: vi.fn(),
    openProfilePanel: vi.fn()
  });

const manageButton = (canManage: boolean) =>
  setup(canManage).operationButtonsProps.value.buttons?.find(
    button => button.code === "manage"
  );

describe("AI 档案管理入口", () => {
  it("无 retrieve/edit/probe/destroy 权限时不渲染管理入口", () => {
    expect(manageButton(false)?.show).toBe(false);
  });

  it("有任一管理动作权限时渲染管理入口", () => {
    expect(manageButton(true)?.show).toBe(true);
  });
});
