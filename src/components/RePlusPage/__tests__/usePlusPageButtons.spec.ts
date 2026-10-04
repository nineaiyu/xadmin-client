import { describe, expect, it } from "vitest";
import { ref } from "vue";
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
  operationButtonsProps?: Record<string, unknown>
) {
  const props = {
    api: {},
    auth: authBits,
    isTree: false,
    operationButtonsProps,
    tableBarButtonsProps: undefined
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
    handleDetail: () => undefined
  });
  return operationButtons.value;
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
    expect(buttons.find(button => button.code === "update")?.show).toBe(-30);
  });

  it("hideEdit 只藏默认编辑按钮，删除/详情按钮不受影响", () => {
    const buttons = buildOperationButtons(POLICY_AUTH, { hideEdit: true });
    expect(buttons.find(button => button.code === "update")?.show).toBe(false);
    expect(buttons.find(button => button.code === "delete")?.show).toBe(-20);
    expect(buttons.find(button => button.code === "detail")?.show).toBe(-10);
  });

  it("hideEdit 不回写 auth 位：boolean 列内联开关按 partialUpdate||update 判定仍可用", () => {
    // 回归背景：登录策略页曾以关 auth.partialUpdate 的方式藏编辑按钮，
    // 连带把 is_active 内联开关置灰。hideEdit 方案下权限位必须保持原值。
    const authBits = { ...POLICY_AUTH };
    const buttons = buildOperationButtons(authBits, { hideEdit: true });
    expect(buttons.find(button => button.code === "update")?.show).toBe(false);
    expect(authBits.partialUpdate).toBe(true);
    expect(authBits.update).toBe(false);
  });

  it("未声明 hideEdit 时行为不变（undefined 视同 false）", () => {
    const buttons = buildOperationButtons(POLICY_AUTH, {});
    expect(buttons.find(button => button.code === "update")?.show).toBe(-30);
  });
});
