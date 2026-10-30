import { mount, type VueWrapper } from "@vue/test-utils";
import { defineComponent } from "vue";
import { describe, expect, it, vi } from "vitest";

vi.mock("vue-i18n", async importOriginal => {
  const actual = await importOriginal<typeof import("vue-i18n")>();
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key })
  };
});

import type { ScreenLayoutPane } from "@/api/dataset/analysis";
import type { DatasetItem } from "@/api/dataset/datasets";
import PaneMetricFields from "../PaneMetricFields.vue";

/**
 * 指标卡属性段：切换数据集必须落「服务端合法态」。
 *
 * 服务端对 sum/avg 缺 value_field 直接拒绝（screen_layout.py）——切数据集后保留
 * 旧 metric 而取值列被清空是「中间态」，带病保存会让整张画布 400。
 * 这里钉住：切数据集 → 聚合口径重置 count + 取值列清空（emit 契约）。
 */

const pane = (extra: Partial<ScreenLayoutPane> = {}): ScreenLayoutPane =>
  ({
    pk: "p1",
    type: "metric",
    x: 0,
    y: 0,
    w: 3,
    h: 2,
    dataset: "data-1",
    metric: "count",
    ...extra
  }) as ScreenLayoutPane;

const datasets = [
  {
    pk: "data-1",
    name: "销售",
    columns: ["amount"],
    numeric_columns: ["amount"]
  },
  { pk: "data-2", name: "库存", columns: ["qty"], numeric_columns: ["qty"] },
  { pk: "data-3", name: "日志", columns: ["msg"], numeric_columns: [] }
] as DatasetItem[];

/** el-form-item 桩需渲染默认插槽（select 桩在其内），其余原样丢弃 */
const ElFormItemStub = defineComponent({
  name: "ElFormItemStub",
  template: "<div><slot /></div>"
});

/** el-select 以最小桩承载：只透传 data-testid 与 change 事件（断言走 emit 契约） */
const ElSelectStub = defineComponent({
  name: "ElSelectStub",
  props: { modelValue: { type: [String, Number], default: "" } },
  emits: ["change", "update:modelValue"],
  template: '<div class="metric-select-stub" />'
});

/** 触发桩 select 的 change 事件（桩根元素继承 data-testid，以此定位） */
const changeStub = (
  wrapper: ReturnType<typeof mountFields>,
  testId: string,
  value: string
) => {
  const stub = wrapper.findComponent(`[data-testid="${testId}"]`) as VueWrapper;
  stub.vm.$emit("change", value);
};

const mountFields = (paneProps: ScreenLayoutPane) =>
  mount(PaneMetricFields, {
    props: { pane: paneProps, datasets },
    global: {
      stubs: {
        "el-form-item": ElFormItemStub,
        "el-select": ElSelectStub,
        "el-option": true
      }
    }
  });

describe("PaneMetricFields", () => {
  it("切换数据集：metric 重置为 count、取值列清空（不留 sum + 待选列的非法中间态）", async () => {
    const wrapper = mountFields(pane({ metric: "sum", value_field: "amount" }));
    changeStub(wrapper, "inspector-metric-dataset", "data-2");
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("update")![0]).toEqual([
      { dataset: "data-2", metric: "count", value_field: undefined }
    ]);
  });

  it("切换指标 sum/avg：取值列缺省补首个数值列，原列仍属新数据集时保留", async () => {
    const wrapper = mountFields(pane({ dataset: "data-1" }));
    changeStub(wrapper, "inspector-metric-type", "sum");
    await wrapper.vm.$nextTick();
    // 无原值 → 缺省补数值列首项
    expect(wrapper.emitted("update")![0]).toEqual([
      { metric: "sum", value_field: "amount" }
    ]);
  });

  it("切换指标 count：取值列清掉（服务端合法态）", async () => {
    const wrapper = mountFields(pane({ metric: "sum", value_field: "amount" }));
    changeStub(wrapper, "inspector-metric-type", "count");
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("update")![0]).toEqual([
      { metric: "count", value_field: undefined }
    ]);
  });

  it("新数据集无数值列：同样重置为 count（count 是任何数据集下都合法的口径）", async () => {
    const wrapper = mountFields(pane({ dataset: "data-1", metric: "count" }));
    changeStub(wrapper, "inspector-metric-dataset", "data-3");
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("update")![0]).toEqual([
      { dataset: "data-3", metric: "count", value_field: undefined }
    ]);
  });
});
