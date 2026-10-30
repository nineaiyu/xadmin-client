import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { describe, expect, it } from "vitest";

import { ReSplitPane } from "../index";
import { calcSplitPercent, isPercentAllowed } from "../geometry";

const i18n = createI18n({
  legacy: false,
  locale: "zh-CN",
  messages: { "zh-CN": { buttons: { splitPaneReset: "重置分栏" } } }
});

const mountPane = () =>
  mount(ReSplitPane, {
    props: {
      splitSet: { minPercent: 10, defaultPercent: 40, split: "vertical" },
      percent: 60
    },
    global: { plugins: [i18n] },
    slots: {
      paneL: "<div class='left'>左</div>",
      paneR: "<div class='right'>右</div>"
    }
  });

describe("ReSplitPane", () => {
  it("渲染左右栏并应用受控百分比", () => {
    const wrapper = mountPane();
    expect(wrapper.find(".left").text()).toBe("左");
    expect(wrapper.find(".right").text()).toBe("右");
    expect(wrapper.find(".splitter-paneL").attributes("style")).toContain(
      "width: 60%"
    );
  });

  it("双击分隔条恢复到 defaultPercent", async () => {
    const wrapper = mountPane();
    await wrapper.find(".splitter-pane-resizer").trigger("dblclick");
    expect(wrapper.emitted("update:percent")?.[0]).toEqual([40]);
    expect(wrapper.emitted("reset")?.[0]).toEqual([40]);
    expect(wrapper.emitted("drag-end")?.[0]).toEqual([40]);
  });

  it("未拖动的按钮按下按「点击重置」处理", async () => {
    const wrapper = mountPane();
    const button = wrapper.find(".splitter-reset-btn");
    await button.trigger("mousedown", { button: 0 });
    window.dispatchEvent(new MouseEvent("mouseup"));
    expect(wrapper.emitted("reset")?.[0]).toEqual([40]);
  });
});

describe("ReSplitPane geometry", () => {
  it("按容器尺寸换算百分比并保留两位小数", () => {
    expect(calcSplitPercent(700, 0, 1000)).toBe(70);
    expect(calcSplitPercent(333, 0, 1000)).toBe(33.3);
  });

  it("容器尺寸为 0 或非有限值时返回 null", () => {
    expect(calcSplitPercent(700, 0, 0)).toBeNull();
    expect(calcSplitPercent(700, 0, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("双侧最小边界外不允许更新", () => {
    expect(isPercentAllowed(10, 10)).toBe(false);
    expect(isPercentAllowed(90, 10)).toBe(false);
    expect(isPercentAllowed(50, 10)).toBe(true);
  });
});
