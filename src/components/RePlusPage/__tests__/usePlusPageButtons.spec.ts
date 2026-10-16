import { describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";
import { usePlusPageButtons } from "../src/utils/usePlusPageButtons";
import type { RePlusPageProps } from "../src/utils/types";

const t = ((key: string) => key) as never;

const treeProps = ref({
  hasChildren: "has_children",
  children: "children",
  checkStrictly: false
});

function buildOperationButtons(
  authBits: Record<string, boolean>,
  operationButtonsProps?: Record<string, unknown>,
  options?: {
    detailRowFetch?: RePlusPageProps["detailRowFetch"];
    handleDetail?: (row: Record<string, unknown>) => void | Promise<void>;
  }
) {
  const props = {
    api: {},
    auth: authBits,
    isTree: false,
    operationButtonsProps,
    tableBarButtonsProps: undefined,
    detailRowFetch: options?.detailRowFetch
  } as RePlusPageProps;
  const { operationButtons } = usePlusPageButtons({
    props,
    t,
    treeProps,
    searchFields: ref({}) as never,
    handleGetData: () => undefined,
    getSelectPks: () => [],
    handleAddOrEdit: () => undefined,
    handleDelete: () => undefined,
    handleDetail: options?.handleDetail ?? (() => undefined)
  });
  return operationButtons.value;
}

/** show 兼容静态值与按行函数两种形态（按行函数传空行求值） */
function evalShow(button: { show: unknown }, row: unknown = {}) {
  if (typeof button.show !== "function") return button.show;
  return (button.show as (row: unknown) => number | boolean)(row);
}

const findButton = (buttons: { code: string | number }[], code: string) =>
  buttons.find(button => button.code === code) as {
    code: string;
    show: unknown;
    index?: number;
  };

/** 排序位统一走 index（show 只管显隐，不再承载排序数值） */
function expectOrder(button: { index?: number }, expectedIndex: number): void {
  expect(button.index).toBe(expectedIndex);
}

/** 登录策略页等「自有编辑弹窗」页面的实测权限位：partialUpdate 可用但 update 关闭 */
const POLICY_AUTH = {
  list: true,
  retrieve: true,
  partialUpdate: true,
  update: false,
  destroy: true
};

describe("usePlusPageButtons hideEdit", () => {
  it("默认编辑按钮随权限位显隐：partialUpdate 命中即显示（内联开关可用时的既有行为）", () => {
    const buttons = buildOperationButtons(POLICY_AUTH);
    const update = findButton(buttons, "update");
    expect(evalShow(update)).toBe(true);
    expectOrder(update, -30);
  });

  it("hideEdit 只藏默认编辑按钮，删除/详情按钮不受影响", () => {
    const buttons = buildOperationButtons(POLICY_AUTH, { hideEdit: true });
    expect(evalShow(findButton(buttons, "update"))).toBe(false);
    const del = findButton(buttons, "delete");
    expect(evalShow(del)).toBe(true);
    expectOrder(del, -20);
    const detail = findButton(buttons, "detail");
    expect(evalShow(detail)).toBe(true);
    expectOrder(detail, -10);
  });

  it("hideEdit 不回写 auth 位：boolean 列内联开关按 partialUpdate||update 判定仍可用", () => {
    // 回归背景：登录策略页曾以关 auth.partialUpdate 的方式藏编辑按钮，
    // 连带把 is_active 内联开关置灰。hideEdit 方案下权限位必须保持原值。
    const authBits = { ...POLICY_AUTH };
    const buttons = buildOperationButtons(authBits, { hideEdit: true });
    expect(evalShow(findButton(buttons, "update"))).toBe(false);
    expect(authBits.partialUpdate).toBe(true);
    expect(authBits.update).toBe(false);
  });

  it("未声明 hideEdit 时行为不变（undefined 视同 false）", () => {
    const buttons = buildOperationButtons(POLICY_AUTH, {});
    expect(evalShow(findButton(buttons, "update"))).toBe(true);
  });
});

describe("usePlusPageButtons 行级归属守卫", () => {
  it("行数据 is_owner=false 时默认编辑/删除按钮隐藏", () => {
    const buttons = buildOperationButtons(POLICY_AUTH);
    const row = { pk: 1, is_owner: false };
    expect(evalShow(findButton(buttons, "update"), row)).toBe(false);
    expect(evalShow(findButton(buttons, "delete"), row)).toBe(false);
  });

  it("is_owner=true 的行按钮照常显示", () => {
    const buttons = buildOperationButtons(POLICY_AUTH);
    const row = { pk: 1, is_owner: true };
    const update = findButton(buttons, "update");
    const del = findButton(buttons, "delete");
    expect(evalShow(update, row)).toBe(true);
    expect(evalShow(del, row)).toBe(true);
    expectOrder(update, -30);
    expectOrder(del, -20);
  });

  it("未下发 is_owner 的行不收敛（存量接口零回归）", () => {
    const buttons = buildOperationButtons(POLICY_AUTH);
    expect(evalShow(findButton(buttons, "update"), { pk: 1 })).toBe(true);
    expect(evalShow(findButton(buttons, "delete"), { pk: 1 })).toBe(true);
  });
});

describe("usePlusPageButtons 详情兜底拉取（detailRowFetch）", () => {
  type DetailButton = {
    code: string;
    onClick: (context: {
      row: Record<string, unknown>;
      loading: { value: boolean };
    }) => void;
  };

  const clickDetail = (buttons: { code: string | number }[]) =>
    buttons.find(button => button.code === "detail") as DetailButton;

  it("挂 detailRowFetch 时详情点击进入 loading，抽屉数据就绪后释放", async () => {
    let resolveDetail: (() => void) | undefined;
    const handleDetail = vi.fn(
      () =>
        new Promise<void>(resolve => {
          resolveDetail = resolve;
        })
    );
    const buttons = buildOperationButtons(POLICY_AUTH, undefined, {
      detailRowFetch: async () => ({ body: "full" }),
      handleDetail
    });
    const loading = { value: false };
    clickDetail(buttons).onClick({ row: { pk: 1 }, loading });
    expect(loading.value).toBe(true);
    resolveDetail!();
    await nextTick();
    await Promise.resolve();
    expect(loading.value).toBe(false);
    expect(handleDetail).toHaveBeenCalledTimes(1);
  });

  it("未挂 detailRowFetch 时详情点击行为不变（loading 不介入）", async () => {
    const handleDetail = vi.fn();
    const buttons = buildOperationButtons(POLICY_AUTH, undefined, {
      handleDetail
    });
    const loading = { value: false };
    clickDetail(buttons).onClick({ row: { pk: 1 }, loading });
    expect(loading.value).toBe(false);
    expect(handleDetail).toHaveBeenCalledTimes(1);
  });
});
