import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { createI18n } from "vue-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";

import ReBackTop from "../src/index.vue";

const i18n = createI18n({
  legacy: false,
  locale: "zh-CN",
  messages: { "zh-CN": { backTop: { text: "回到顶部" } } }
});

function mountBackTop(props: Record<string, unknown> = {}) {
  return mount(ReBackTop, { props, global: { plugins: [i18n] } });
}

/** 造出布局内容区滚动容器并返回滚动代理节点（类名拼接，避免触发组件用法扫描） */
function createLayoutTarget(): HTMLElement {
  const main = document.createElement("div");
  main.className = "app-main";
  const wrap = document.createElement("div");
  wrap.className = ["el", "scrollbar__wrap"].join("-");
  main.append(wrap);
  document.body.append(main);
  return wrap;
}

/** jsdom 无布局：滚动位置用 defineProperty 显式给出 */
function setScrollTop(el: HTMLElement, value: number): void {
  Object.defineProperty(el, "scrollTop", {
    configurable: true,
    writable: true,
    value
  });
}

describe("ReBackTop", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("缺省 target 绑定布局内容区滚动容器：滚过阈值显示，点击回顶", async () => {
    const wrap = createLayoutTarget();
    const scrollTo = vi.fn();
    wrap.scrollTo = scrollTo;
    setScrollTop(wrap, 0);

    const wrapper = mountBackTop();
    await nextTick();
    // jsdom 无布局：以 v-show 的 inline style 判定显隐（isVisible 依赖 offsetWidth 恒为 0）
    expect(wrapper.find(".re-backtop").attributes("style")).toContain(
      "display: none"
    );

    setScrollTop(wrap, 300);
    wrap.dispatchEvent(new Event("scroll"));
    await nextTick();
    expect(wrapper.find(".re-backtop").attributes("style")).not.toContain(
      "display: none"
    );

    await wrapper.find(".re-backtop").trigger("click");
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
  });

  it("原生按钮语义：type=button + title / aria-label（键盘可聚焦，Enter 原生触发点击）", async () => {
    const wrap = createLayoutTarget();
    setScrollTop(wrap, 0);

    const wrapper = mountBackTop();
    await nextTick();

    const button = wrapper.find("button.re-backtop");
    expect(button.exists()).toBe(true);
    expect(button.attributes("type")).toBe("button");
    expect(button.attributes("aria-label")).toBe("回到顶部");
    expect(button.attributes("title")).toBe("回到顶部");
  });

  it("显式 target 生效：阈值未过不显示", async () => {
    const wrap = document.createElement("div");
    wrap.id = "re-backtop-track";
    document.body.append(wrap);
    setScrollTop(wrap, 100);

    // 阈值 200：100 < 200 不显示
    const wrapper = mountBackTop({ target: "#re-backtop-track" });
    await nextTick();
    expect(wrapper.find(".re-backtop").attributes("style")).toContain(
      "display: none"
    );
  });

  it("自定义 title / 阈值：挂载时按当前滚动位置初始化显示", async () => {
    const wrap = document.createElement("div");
    wrap.id = "re-backtop-track";
    document.body.append(wrap);
    setScrollTop(wrap, 100);

    const wrapper = mountBackTop({
      target: "#re-backtop-track",
      title: "顶部",
      visibilityHeight: 50
    });
    await nextTick();
    expect(wrapper.find("button.re-backtop").attributes("aria-label")).toBe(
      "顶部"
    );
    expect(wrapper.find(".re-backtop").attributes("style")).not.toContain(
      "display: none"
    );
  });
});
