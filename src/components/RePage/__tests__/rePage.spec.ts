import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import RePage from "../src/index.vue";

const mountPage = (props: Record<string, unknown> = {}, slots = {}) =>
  mount(RePage, { props, slots });

describe("RePage 通用页面骨架", () => {
  it("无标题 / 描述 / 扩展插槽时不渲染页头", () => {
    const wrapper = mountPage({}, { default: "<div class='body' />" });
    expect(wrapper.find(".re-page__header").exists()).toBe(false);
    expect(wrapper.find(".body").exists()).toBe(true);
  });

  it("title / description 渲染页头，extra 插槽渲染在右侧", () => {
    const wrapper = mountPage(
      { title: "用户详情", description: "只读信息" },
      { extra: "<button class='act'>编辑</button>" }
    );
    expect(wrapper.find(".re-page__title").text()).toBe("用户详情");
    expect(wrapper.find(".re-page__desc").text()).toBe("只读信息");
    expect(wrapper.find(".re-page__extra .act").text()).toBe("编辑");
  });

  it("仅 extra 插槽也触发页头（无标题场景）", () => {
    const wrapper = mountPage({}, { extra: "<span class='act' />" });
    expect(wrapper.find(".re-page__header").exists()).toBe(true);
  });

  it("title 插槽优先于 title 属性", () => {
    const wrapper = mountPage(
      { title: "属性标题" },
      { title: "<span class='custom'>自定义</span>" }
    );
    expect(wrapper.find(".custom").text()).toBe("自定义");
    expect(wrapper.find(".re-page__title").exists()).toBe(false);
  });

  it("页脚仅在传入 footer 插槽时渲染；footerFixed 加吸附类", () => {
    expect(mountPage({}).find(".re-page__footer").exists()).toBe(false);
    const fixed = mountPage(
      { footerFixed: true },
      { footer: "<div class='ft' />" }
    );
    expect(fixed.find(".re-page__footer").classes()).toContain("is-fixed");
  });

  it("autoContentHeight 开启内容区自管滚动，并按 heightOffset 让位", () => {
    const wrapper = mountPage({ autoContentHeight: true, heightOffset: 48 });
    const content = wrapper.find(".re-page__content");
    expect(content.classes()).toContain("is-auto");
    expect(content.attributes("style")).toContain("margin-bottom: 48px");
  });

  it("padded 默认关闭（不叠加 layout 留白），开启后挂 is-padded", () => {
    expect(mountPage({}).classes()).not.toContain("is-padded");
    expect(mountPage({ padded: true }).classes()).toContain("is-padded");
  });

  it("stats / toolbar 插槽按「页头 → 统计 → 工具栏 → 内容」顺序渲染", () => {
    const wrapper = mountPage(
      { title: "概览" },
      {
        stats: "<div class='stats' />",
        toolbar: "<div class='toolbar' />",
        default: "<div class='body' />"
      }
    );
    const regions = wrapper
      .findAll(
        ".re-page__header, .re-page__stats, .re-page__toolbar, .re-page__content"
      )
      .map(node => node.classes()[0]);
    expect(regions).toEqual([
      "re-page__header",
      "re-page__stats",
      "re-page__toolbar",
      "re-page__content"
    ]);
    expect(wrapper.find(".re-page__content .body").exists()).toBe(true);
  });

  it("empty 开启时以 #empty 插槽替代默认内容", () => {
    const wrapper = mountPage(
      { empty: true },
      { default: "<div class='body' />", empty: "<div class='nothing' />" }
    );
    expect(wrapper.find(".nothing").exists()).toBe(true);
    expect(wrapper.find(".body").exists()).toBe(false);
  });
});
