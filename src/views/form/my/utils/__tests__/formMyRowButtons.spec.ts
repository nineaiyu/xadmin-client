import { describe, expect, it, vi } from "vitest";
import type { RecordType } from "plus-pro-components";
import { useFormMyRowButtons } from "../formMyRowButtons";

/**
 * 「我的填报」行按钮显隐矩阵：终态（已通过 / 已撤回）与审批中只读，
 * 只有草稿与驳回态可编辑/删除（与后端 `_creator_guard` 同口径）。
 */
const build = (
  flags = {
    canEdit: true,
    canDestroy: true,
    canResubmit: true,
    canSubmit: true,
    canCancel: true
  }
) =>
  useFormMyRowButtons({
    t: ((key: string) => key) as never,
    flags,
    actions: {
      openDetail: vi.fn(),
      openEdit: vi.fn(),
      submitDraft: vi.fn(),
      resubmit: vi.fn(),
      remove: vi.fn(),
      cancel: vi.fn()
    }
  }).operationButtonsProps.value;

const button = (code: string, flags?: Parameters<typeof build>[0]) =>
  build(flags).buttons?.find(item => item.code === code);

const visible = (
  code: string,
  status: string,
  flags?: Parameters<typeof build>[0]
) =>
  Boolean(
    (button(code, flags)?.show as (row: RecordType) => boolean)?.({
      status: { value: status }
    })
  );

describe("我的填报行按钮", () => {
  it.each(["DRAFT", "REJECTED"])("%s 可编辑可删除", status => {
    expect(visible("my-edit", status)).toBe(true);
    expect(visible("my-delete", status)).toBe(true);
  });

  it.each(["PENDING", "APPROVED", "CANCELLED"])(
    "%s 只读（无编辑/删除入口）",
    status => {
      expect(visible("my-edit", status)).toBe(false);
      expect(visible("my-delete", status)).toBe(false);
    }
  );

  it("提交草稿仅草稿态可见，重新提交仅驳回态可见", () => {
    expect(visible("my-submit", "DRAFT")).toBe(true);
    expect(visible("my-submit", "REJECTED")).toBe(false);
    expect(visible("my-resubmit", "REJECTED")).toBe(true);
    expect(visible("my-resubmit", "DRAFT")).toBe(false);
  });

  it("无权限时对应按钮一律隐藏", () => {
    const noPerms = {
      canEdit: false,
      canDestroy: false,
      canResubmit: false,
      canSubmit: false,
      canCancel: false
    };
    expect(visible("my-edit", "DRAFT", noPerms)).toBe(false);
    expect(visible("my-delete", "DRAFT", noPerms)).toBe(false);
    expect(visible("my-submit", "DRAFT", noPerms)).toBe(false);
    expect(visible("my-resubmit", "REJECTED", noPerms)).toBe(false);
  });

  it("撤回仅审批中且有实例时可见", () => {
    const show = button("my-withdraw")?.show as (row: RecordType) => boolean;
    expect(show({ status: { value: "PENDING" }, instance: "i-1" })).toBe(true);
    expect(show({ status: { value: "PENDING" }, instance: null })).toBe(false);
    expect(show({ status: { value: "DRAFT" }, instance: "i-1" })).toBe(false);
  });

  it("详情按钮始终可见（终态也可查看留痕）", () => {
    const detail = button("my-detail");
    expect(detail?.show).toBe(true);
  });
});
