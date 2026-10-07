import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";

vi.mock("vue-i18n", async importOriginal => {
  const actual = await importOriginal<typeof import("vue-i18n")>();
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key, te: () => false })
  };
});

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

// 权限面固定放行（本 spec 只断言行归属条件，不涉及权限码）
vi.mock("@/router/utils", () => ({
  hasAuth: () => true,
  usePageAuth: () => ({ create: false, update: false, partialUpdate: false })
}));

vi.mock("@/api/dataset/analysis", () => ({
  reportApi: {
    list: vi.fn(),
    create: vi.fn(),
    partialUpdate: vi.fn()
  },
  runReport: vi.fn(),
  relatedPk: (value: unknown) =>
    value && typeof value === "object" ? (value as { pk?: string }).pk : value
}));

vi.mock("@/api/dataset/datasets", () => ({
  datasetApi: { list: vi.fn(), execute: vi.fn() },
  listRows: (res: unknown) =>
    (res as { data?: { results?: unknown[] } })?.data?.results ?? []
}));

vi.mock("@/utils/fetchAllRows", () => ({
  fetchAllRows: vi.fn().mockResolvedValue({ code: 1000, data: { results: [] } })
}));

vi.mock("@/components/ReDialog", () => ({ addDialog: vi.fn() }));
vi.mock("@/components/ReDialog/size", () => ({ dialogSize: (v: string) => v }));
vi.mock("@/utils/message", () => ({ message: vi.fn() }));
vi.mock("@/utils/dict", () => ({ statusTagProps: () => ({}) }));
vi.mock("@/components/RePlusPage", () => ({
  formatPageColumns: (cols: unknown) => cols
}));

vi.mock("../components/ReportForm.vue", () => ({
  default: { name: "ReportForm", render: () => null }
}));

import { useReport } from "../hook";

/** 行操作按钮按 code 取 show 判定结果 */
function showOf(buttons: unknown[], code: string, row: unknown) {
  const button = buttons.find(
    item => (item as { code?: string }).code === code
  );
  expect(button, `button ${code} should exist`).toBeTruthy();
  const show = (button as { show: unknown }).show;
  expect(typeof show, `show of ${code} should be row predicate`).toBe(
    "function"
  );
  return (show as (row: unknown) => unknown)(row);
}

describe("useReport 行操作按钮显隐（创建者口径）", () => {
  it("非创建者行（is_owner === false）不显示立即运行/设计/编辑", () => {
    const { operationButtonsProps } = useReport(ref());
    const buttons = operationButtonsProps.value.buttons ?? [];
    const row = { pk: "r1", is_owner: false };
    expect(showOf(buttons, "run", row)).toBe(false);
    expect(showOf(buttons, "design", row)).toBe(false);
    expect(showOf(buttons, "edit", row)).toBe(false);
  });

  it("创建者行与历史行（缺 is_owner）显示立即运行/设计/编辑", () => {
    const { operationButtonsProps } = useReport(ref());
    const buttons = operationButtonsProps.value.buttons ?? [];
    for (const row of [{ pk: "r2", is_owner: true }, { pk: "r3" }]) {
      expect(Boolean(showOf(buttons, "run", row))).toBe(true);
      expect(Boolean(showOf(buttons, "design", row))).toBe(true);
      expect(Boolean(showOf(buttons, "edit", row))).toBe(true);
    }
  });
});
