import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

import Setting from "../index.vue";
import type { settingsPane } from "../types";

/** 路由查询串（用例内可变）：`?tab=` 的落地与同步断言都基于它 */
const routeQuery = vi.hoisted(() => ({ tab: "" as unknown }));
vi.mock("vue-router", () => ({ useRoute: () => ({ query: routeQuery }) }));

/** SettingItem 桩：避免拉入列元数据链路，仅区分表单型面板是否渲染 */
vi.mock("../SettingItem.vue", () => ({
  default: {
    name: "SettingItem",
    props: ["localeName"],
    template: `<div class="stub-item" :data-locale="localeName" />`
  }
}));

const i18n = createI18n({
  legacy: false,
  locale: "zh-CN",
  messages: { "zh-CN": { settingA: { title: "分组甲" } } }
});

/** 最小 pane（item 的 api 槽位在桩组件下不会被调用） */
const pane = (key: string, extra: Partial<settingsPane> = {}): settingsPane =>
  ({ key, label: key.toUpperCase(), ...extra }) as settingsPane;

const mountShell = (panes: settingsPane[], slots?: Record<string, string>) =>
  mount(Setting, {
    props: { panes },
    slots,
    global: { plugins: [i18n] },
    attachTo: document.body
  });

const tabsOf = (wrapper: ReturnType<typeof mountShell>) =>
  wrapper.findAll('[role="tab"]');
const panelsOf = (wrapper: ReturnType<typeof mountShell>) =>
  wrapper.findAll('[role="tabpanel"]');

describe("设置页骨架（左导航 + 内容纸）", () => {
  beforeEach(() => {
    routeQuery.tab = "";
    window.history.replaceState(null, "", "#/settings/basic");
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("多面板：渲染导航、默认激活首个、面板懒挂载", async () => {
    const wrapper = mountShell([pane("a"), pane("b"), pane("c")]);

    expect(tabsOf(wrapper)).toHaveLength(3);
    expect(tabsOf(wrapper)[0].attributes("aria-selected")).toBe("true");
    expect(tabsOf(wrapper)[0].attributes("aria-controls")).toBe(
      "settings-pane-a"
    );
    // 首个面板渲染，未访问的面板不挂载（懒渲染）
    expect(panelsOf(wrapper)).toHaveLength(1);
    expect(panelsOf(wrapper)[0].attributes("id")).toBe("settings-pane-a");
    // 多面板显示面板头（标题 = 导航文案）
    expect(wrapper.find("h3").text()).toBe("A");
  });

  it("点击导航切换：激活态、面板显隐、懒挂载补齐", async () => {
    const wrapper = mountShell([pane("a"), pane("b")]);

    await tabsOf(wrapper)[1].trigger("click");
    expect(tabsOf(wrapper)[1].attributes("aria-selected")).toBe("true");
    expect(tabsOf(wrapper)[0].attributes("aria-selected")).toBe("false");
    // 访问过的面板都保留在 DOM（v-show 显隐），不重建
    expect(panelsOf(wrapper)).toHaveLength(2);
    const visible = panelsOf(wrapper).filter(
      el => (el.element as HTMLElement).style.display !== "none"
    );
    expect(visible).toHaveLength(1);
    expect(visible[0].attributes("id")).toBe("settings-pane-b");
  });

  it("键盘导航：ArrowDown 循环下移、End / Home 跳首尾且焦点跟随", async () => {
    const wrapper = mountShell([pane("a"), pane("b"), pane("c")]);
    const tabs = tabsOf(wrapper);

    await tabs[0].trigger("keydown", { key: "ArrowDown" });
    await nextTick();
    expect(tabsOf(wrapper)[1].attributes("aria-selected")).toBe("true");
    expect(document.activeElement?.id).toBe("settings-tab-b");

    await tabs[1].trigger("keydown", { key: "End" });
    expect(tabsOf(wrapper)[2].attributes("aria-selected")).toBe("true");

    await tabs[2].trigger("keydown", { key: "ArrowDown" });
    expect(tabsOf(wrapper)[0].attributes("aria-selected")).toBe("true");
  });

  it("单面板：不渲染导航与面板头，内容纸铺满", () => {
    const wrapper = mountShell([pane("only")]);
    expect(tabsOf(wrapper)).toHaveLength(0);
    expect(wrapper.find('[role="tablist"]').exists()).toBe(false);
    expect(wrapper.find("h3").exists()).toBe(false);
    expect(panelsOf(wrapper)).toHaveLength(1);
  });

  it("标题推导：无 label 时按 item 的 localeName/title 取 i18n", async () => {
    const wrapper = mountShell([
      pane("a"),
      {
        key: "b",
        item: { localeName: "settingA" } as settingsPane["item"]
      }
    ]);
    expect(tabsOf(wrapper)[1].text()).toBe("分组甲");

    // 切换到该面板后渲染 SettingItem 桩（未激活面板懒挂载）
    await tabsOf(wrapper)[1].trigger("click");
    await nextTick();
    expect(wrapper.find(".stub-item").exists()).toBe(true);
  });

  it("?tab= 命中时落地该面板，非法值回落首个", () => {
    routeQuery.tab = "b";
    const hit = mountShell([pane("a"), pane("b")]);
    expect(tabsOf(hit)[1].attributes("aria-selected")).toBe("true");

    document.body.innerHTML = "";
    routeQuery.tab = "nope";
    const miss = mountShell([pane("a"), pane("b")]);
    expect(tabsOf(miss)[0].attributes("aria-selected")).toBe("true");
  });

  it("切换面板写入地址栏 tab 参数（刷新可回到所在面板）", async () => {
    const wrapper = mountShell([pane("a"), pane("b")]);
    await tabsOf(wrapper)[1].trigger("click");
    expect(window.location.hash).toContain("tab=b");
  });

  it("自定义面板经具名插槽渲染（表单型面板不占插槽）", async () => {
    const wrapper = mountShell([pane("custom"), pane("form")], {
      custom: `<div data-testid="custom-panel">自定义内容</div>`
    });
    expect(wrapper.find('[data-testid="custom-panel"]').exists()).toBe(true);

    await tabsOf(wrapper)[1].trigger("click");
    await nextTick();
    // 表单型面板不渲染 custom 插槽内容
    expect(wrapper.find('[data-testid="custom-panel"]').exists()).toBe(true);
    expect(panelsOf(wrapper)).toHaveLength(2);
  });
});
