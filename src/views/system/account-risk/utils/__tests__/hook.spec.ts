import { describe, expect, it, vi } from "vitest";
import { ref, toValue, type Ref } from "vue";
import type { RecordType } from "plus-pro-components";

vi.mock("vue-i18n", async importOriginal => {
  const actual = await importOriginal<typeof import("vue-i18n")>();
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key, te: () => false })
  };
});

vi.mock("@/router/utils", () => ({
  hasAuth: () => true,
  usePageAuth: () => ({
    scan: true,
    handle: true,
    batchHandle: true,
    stats: false
  })
}));

vi.mock("@/api/system/security", () => ({
  accountRiskApi: {
    stats: vi.fn().mockResolvedValue({ code: 1000, data: null }),
    scan: vi.fn(),
    handle: vi.fn(),
    batchHandle: vi.fn()
  }
}));

vi.mock("@/components/ReDialog", () => ({ addDialog: vi.fn() }));
vi.mock("@/components/ReDialog/size", () => ({ dialogSize: (v: string) => v }));
vi.mock("@/components/ReDrawer", () => ({ addDrawer: vi.fn() }));
vi.mock("@/utils/message", () => ({ message: vi.fn() }));
vi.mock("@/components/ReIcon/src/hooks", () => ({
  useRenderIcon: (icon: unknown) => icon
}));

vi.mock("@/components/RePlusPage", () => ({
  handleOperation: vi.fn(),
  formatPageColumns: (cols: unknown) => cols
}));

vi.mock("../components/RiskHandleForm.vue", () => ({
  default: { name: "RiskHandleForm", render: () => null }
}));

import { useAccountRisk, metricEntriesOf, metricText } from "../hook";

describe("metricEntriesOf / metricText（风险明细指标结构化）", () => {
  it("平铺 detail 除去说明/建议后产出指标条目（后端当前结构）", () => {
    const entries = metricEntriesOf({
      description: "desc",
      suggestion: "adv",
      days: 42
    } as RecordType);
    expect(entries).toEqual([["days", 42]]);
  });

  it("metrics 子对象存在时优先消费", () => {
    const entries = metricEntriesOf({
      description: "desc",
      suggestion: "adv",
      metrics: { count: 9, threshold: 5 }
    } as RecordType);
    expect(entries).toEqual([
      ["count", 9],
      ["threshold", 5]
    ]);
  });

  it("metricText：空值占位、标量直出、复合值 JSON 化", () => {
    expect(metricText(null)).toBe("-");
    expect(metricText("")).toBe("-");
    expect(metricText(7)).toBe("7");
    expect(metricText("2026-01-02T03:04:05Z")).toBe("2026-01-02T03:04:05Z");
    expect(metricText({ a: 1 })).toBe('{"a":1}');
  });
});

describe("useAccountRisk 批量处置按钮显隐", () => {
  it("show 为 selection-change 驱动的响应式计算（随选中集合翻转）", () => {
    const tableRef = ref();
    const selectedRows = ref<RecordType[]>([]);
    const { tableBarButtonsProps } = useAccountRisk(tableRef, selectedRows);

    const buttons = tableBarButtonsProps.value.buttons ?? [];
    const batchHandle = buttons.find(button => button.code === "batchHandle");
    expect(batchHandle).toBeTruthy();

    const showRef = batchHandle!.show;
    // show 为 ComputedRef（响应式），不再是每行渲染回调查询选中数
    expect(typeof showRef).not.toBe("function");
    expect(toValue(showRef as Ref<number | boolean>)).toBe(false);

    selectedRows.value = [{ pk: "1" }, { pk: "2" }];
    expect(toValue(showRef as Ref<number | boolean>)).toBe(true);

    selectedRows.value = [];
    expect(toValue(showRef as Ref<number | boolean>)).toBe(false);
  });
});
