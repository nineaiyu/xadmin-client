import { mount } from "@vue/test-utils";
import { ElButton } from "element-plus/es/components/button/index.mjs";
import { nextTick } from "vue";
import { createI18n } from "vue-i18n";
import { describe, expect, it } from "vitest";

import {
  applyParamDefaults,
  limitDisplay,
  pickAllowed,
  splitParams
} from "../src/paramsFold";
import type { CollapseParamSchema } from "../src/types";
import ReCollapseParams from "../src/index.vue";

const i18n = createI18n({
  legacy: false,
  locale: "zh-CN",
  messages: {
    "zh-CN": {
      collapseParams: {
        name: "名称",
        value: "值",
        description: "说明",
        unfold: "展开",
        fold: "收起"
      }
    }
  }
});

const PARAMS: CollapseParamSchema[] = [
  { key: "a", description: "参数 A", defaultValue: 1 },
  { key: "b", description: "参数 B" },
  { key: "c", description: "参数 C" },
  { key: "d", description: "参数 D" },
  { key: "e", description: "参数 E" }
];

function mountPanel(props: Record<string, unknown> = {}) {
  return mount(ReCollapseParams, {
    props: { params: PARAMS, ...props },
    global: { plugins: [i18n], components: { ElButton } }
  });
}

describe("ReCollapseParams 纯逻辑", () => {
  it("splitParams 拆分可见/折叠行（可见至少 1 行）", () => {
    expect(splitParams(PARAMS, 3).visible).toHaveLength(3);
    expect(splitParams(PARAMS, 3).collapsible).toHaveLength(2);
    expect(splitParams(PARAMS, 0).visible).toHaveLength(1);
    expect(splitParams(PARAMS, 99).visible).toHaveLength(5);
  });

  it("applyParamDefaults 补默认值，force 时重置", () => {
    const filled = applyParamDefaults({ a: 9 }, PARAMS);
    expect(filled.a).toBe(9);
    expect(filled.b).toBeUndefined();
    expect(applyParamDefaults({ a: 9 }, PARAMS, true).a).toBe(1);
  });

  it("pickAllowed 只保留 schema 声明的键", () => {
    expect(pickAllowed({ a: 1, zz: 2 }, PARAMS)).toEqual({ a: 1 });
  });

  it("limitDisplay 按 min/max 生成区间文案", () => {
    expect(limitDisplay({ min: 1, max: 9 })).toBe("[1,9]");
    expect(limitDisplay({ min: 1 })).toBe("min:1");
    expect(limitDisplay({ max: 9 })).toBe("max:9");
    expect(limitDisplay()).toBe("");
  });
});

describe("ReCollapseParams 组件", () => {
  it("默认只渲染可见行，展开后渲染全部", async () => {
    const wrapper = mountPanel({ visibleCount: 3 });
    expect(wrapper.findAll(".re-collapse-params__row")).toHaveLength(3);

    wrapper.vm.toggleCollapsed();
    await nextTick();
    expect(wrapper.findAll(".re-collapse-params__row")).toHaveLength(5);
  });

  it("defaultOpen 时初始即全部展开", () => {
    const wrapper = mountPanel({ visibleCount: 3, defaultOpen: true });
    expect(wrapper.findAll(".re-collapse-params__row")).toHaveLength(5);
  });

  it("updateValues 按白名单批量赋值并派发 update:value", async () => {
    const wrapper = mountPanel({ visibleCount: 3 });
    wrapper.vm.updateValues({ b: "x", zz: "y" });
    await nextTick();

    const emitted = wrapper.emitted("update:value");
    expect(emitted?.at(-1)?.[0]).toMatchObject({ b: "x" });
    expect(
      (emitted?.at(-1)?.[0] as Record<string, unknown>).zz
    ).toBeUndefined();
  });

  it("resetValues 回到 schema 默认值", async () => {
    const wrapper = mountPanel({ visibleCount: 3 });
    wrapper.vm.updateValues({ a: 100 });
    wrapper.vm.resetValues();
    await nextTick();
    expect(
      (wrapper.emitted("update:value")?.at(-1)?.[0] as Record<string, unknown>)
        .a
    ).toBe(1);
  });

  it("label 优先于 key 展示（缺省回落 key）", () => {
    const wrapper = mountPanel({
      visibleCount: 2,
      params: [
        { key: "k1", label: "展示名", description: "d1" },
        { key: "k2", description: "d2" }
      ]
    });
    const names = wrapper
      .findAll(".re-collapse-params__cell--name")
      .map(node => node.text());
    // 首项是表头「名称」，其后为参数行
    expect(names).toEqual(["名称", "展示名", "k2"]);
  });

  it("展开按钮暴露 aria-expanded / aria-controls（关联折叠区），切换后状态跟随", async () => {
    const wrapper = mountPanel({ visibleCount: 3 });
    const body = wrapper.find(".re-collapse-params__body");
    const trigger = wrapper.find(".re-collapse-params__trigger button");
    expect(trigger.exists()).toBe(true);
    expect(trigger.attributes("aria-expanded")).toBe("false");

    const bodyId = body.attributes("id");
    expect(bodyId).toBeTruthy();
    expect(trigger.attributes("aria-controls")).toBe(bodyId);

    await trigger.trigger("click");
    expect(trigger.attributes("aria-expanded")).toBe("true");
  });
});
