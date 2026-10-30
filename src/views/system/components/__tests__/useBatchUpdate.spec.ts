import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ReDialog", () => ({ addDialog: vi.fn() }));
vi.mock("@/components/ReDialog/size", () => ({ dialogSize: () => "520px" }));
vi.mock("@/components/RePlusPage", () => ({ handleOperation: vi.fn() }));
vi.mock("@/utils/message", () => ({ message: vi.fn() }));
vi.mock("@/utils/apiError", () => ({
  normalizeError: (error: unknown) => error
}));

import { addDialog } from "@/components/ReDialog";
import { useActiveBatchUpdate } from "../useActiveBatchUpdate";
import { useBatchUpdate } from "../useBatchUpdate";

/**
 * 批量更新按钮显隐：必须同时满足「持有 batchUpdate 权限点」与「已勾选行」。
 * 只看勾选会让无权限角色看到按钮，点开必然 403（历史缺陷）。
 */
const build = (canBatch: boolean | undefined, selected: number[] = [1]) => {
  const tableRef = { value: { getSelectPks: () => selected } };
  return useBatchUpdate({
    t: ((key: string) => key) as never,
    api: {} as never,
    tableRef: tableRef as never,
    fields: [],
    canBatch
  }).batchUpdateButton;
};

const visible = (button: ReturnType<typeof build>) => {
  const show = button.show as
    boolean | ((row: unknown, button: unknown) => boolean) | undefined;
  return typeof show === "function" ? Boolean(show({}, button)) : Boolean(show);
};

describe("useBatchUpdate", () => {
  it("有权限且有勾选时显示", () => {
    expect(visible(build(true))).toBe(true);
  });

  it("无权限时即使有勾选也不显示", () => {
    expect(visible(build(false))).toBe(false);
  });

  it("有权限但无勾选时不显示", () => {
    expect(visible(build(true, []))).toBe(false);
  });

  it("未显式传入 canBatch 时 fail-closed 不显示", () => {
    expect(visible(build(undefined))).toBe(false);
  });
});

describe("useActiveBatchUpdate", () => {
  const buildActive = (options: {
    key?: string;
    labelKey?: string;
    canBatch?: boolean;
    selected?: number[];
  }) => {
    const tableRef = {
      value: { getSelectPks: () => options.selected ?? [1] }
    };
    const api = { batchUpdate: vi.fn() };
    const button = useActiveBatchUpdate({
      t: ((key: string) => key) as never,
      api: api as never,
      tableRef: tableRef as never,
      key: options.key,
      labelKey: options.labelKey,
      canBatch: options.canBatch
    }).batchUpdateButton;
    return { button, api };
  };

  /** 打开弹窗后从内容组件 VNode 读取字段白名单 */
  const dialogFields = () => {
    const options = vi.mocked(addDialog).mock.calls[0][0] as {
      contentRenderer: () => { props: Record<string, unknown> };
    };
    return options.contentRenderer().props.fields;
  };

  it("默认写入 is_active 布尔字段，并保持权限位显隐", () => {
    const { button } = buildActive({ canBatch: true });
    expect(visible(button)).toBe(true);
    (button.onClick as () => void)();
    expect(dialogFields()).toEqual([
      {
        key: "is_active",
        label: "commonLabels.is_active",
        input_type: "boolean"
      }
    ]);
  });

  it("支持自定义字段 key 与文案 key（保持各页原载荷形状）", () => {
    const { button } = buildActive({
      key: "enabled",
      labelKey: "systemTask.enabled",
      canBatch: true
    });
    (button.onClick as () => void)();
    expect(dialogFields()).toEqual([
      { key: "enabled", label: "systemTask.enabled", input_type: "boolean" }
    ]);
  });

  it("无权限时按钮仍 fail-closed 不显示", () => {
    expect(visible(buildActive({ canBatch: false }).button)).toBe(false);
  });
});
