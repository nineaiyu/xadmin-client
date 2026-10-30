import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import type { Component } from "vue";
import { describe, expect, it } from "vitest";

import StatBar from "../StatBar.vue";
import StatGrid from "../StatGrid.vue";

const i18n = createI18n({
  legacy: false,
  locale: "zh-CN",
  messages: { "zh-CN": { reStat: { empty: "暂无统计数据" } } }
});

const stubs = {
  "el-tag": {
    name: "ElTag",
    props: ["type"],
    template: '<span class="stub-tag"><slot /></span>'
  },
  "el-statistic": {
    name: "ElStatistic",
    props: ["title"],
    template: '<div class="stub-stat"><slot /></div>'
  }
};

const mountWithI18n = (component: Component, props: Record<string, unknown>) =>
  mount(component, {
    props,
    global: { plugins: [i18n], stubs }
  });

describe("ReStatBar 统计条", () => {
  it("轻量文本项渲染「标签 + 值」，0 照常展示", () => {
    const wrapper = mountWithI18n(StatBar, {
      items: [
        { key: "used", label: "已用", value: 12 },
        { key: "count", label: "文件数", value: 0 }
      ]
    });
    expect(wrapper.text()).toContain("已用");
    expect(wrapper.text()).toContain("12");
    expect(wrapper.text()).toContain("文件数");
    expect(wrapper.text()).toContain("0");
  });

  it("text 优先于 value，并按 group 渲染组标题", () => {
    const wrapper = mountWithI18n(StatBar, {
      items: [
        {
          key: "level.high",
          label: "高",
          value: 1,
          text: "1 项",
          tag: true,
          group: "等级"
        },
        { key: "level.low", label: "低", value: 2, tag: true, group: "等级" }
      ]
    });
    expect(wrapper.text()).toContain("等级");
    expect(wrapper.text()).toContain("高 1 项");
    expect(wrapper.text()).toContain("低 2");
    expect(wrapper.findAll(".stub-tag")).toHaveLength(2);
  });

  it("仅 clickable 项抛出 itemClick", async () => {
    const wrapper = mountWithI18n(StatBar, {
      items: [
        { key: "a", label: "可点", value: 1, tag: true, clickable: true },
        { key: "b", label: "不可点", value: 2, tag: true }
      ]
    });
    const tags = wrapper.findAll(".stub-tag");
    await tags[0].trigger("click");
    await tags[1].trigger("click");
    expect(wrapper.emitted("itemClick")).toHaveLength(1);
    expect(wrapper.emitted("itemClick")?.[0][0]).toMatchObject({ key: "a" });
  });

  it("空列表渲染占位文案", () => {
    const wrapper = mountWithI18n(StatBar, { items: [] });
    expect(wrapper.text()).toContain("暂无统计数据");
  });
});

describe("ReStatGrid 统计网格", () => {
  it("text 分支与纯数值分支各自渲染", () => {
    const wrapper = mountWithI18n(StatGrid, {
      items: [
        { key: "calls", label: "调用数", value: 8 },
        { key: "rate", label: "成功率", text: "—" }
      ]
    });
    expect(wrapper.findAll(".stub-stat")).toHaveLength(2);
    expect(wrapper.text()).toContain("8");
    expect(wrapper.text()).toContain("—");
  });

  it("columns / smColumns 以 CSS 变量下发，空列表渲染占位文案", () => {
    const wrapper = mountWithI18n(StatGrid, {
      items: [],
      columns: 5,
      smColumns: 3
    });
    const style = wrapper.attributes("style") ?? "";
    expect(style).toContain("--re-stat-cols: 5");
    expect(style).toContain("--re-stat-cols-sm: 3");
    expect(wrapper.text()).toContain("暂无统计数据");
  });
});
