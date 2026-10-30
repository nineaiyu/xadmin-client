import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import SettingPreview from "../SettingPreview.vue";

const mountPreview = (
  props: Record<string, unknown> = {},
  slots: Record<string, string> = {}
) =>
  mount(SettingPreview, {
    props: { title: "预览标题", ...props },
    slots,
    global: { directives: { loading: {} } }
  });

describe("SettingPreview 预览卡片", () => {
  it("渲染标题、操作区与脚注，并暴露舞台元素", () => {
    const wrapper = mountPreview(
      { tip: "预览说明", testid: "preview-stage" },
      {
        actions: "<button data-testid='preview-action'>刷新</button>",
        default: "<span data-testid='preview-content'>内容</span>"
      }
    );

    expect(wrapper.find(".setting-preview__title").text()).toBe("预览标题");
    expect(wrapper.find("[data-testid='preview-action']").text()).toBe("刷新");
    expect(wrapper.find("[data-testid='preview-content']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='preview-stage']").exists()).toBe(true);
    expect(wrapper.find(".setting-preview__tip").text()).toBe("预览说明");
    expect(wrapper.vm.stageEl).toBe(
      wrapper.find(".setting-preview__stage").element
    );
  });

  it("空状态只渲染占位文案，并挂在指定锚点上", () => {
    const wrapper = mountPreview(
      {
        empty: true,
        emptyText: "加载失败",
        emptyTestid: "preview-empty"
      },
      { default: "<span data-testid='preview-content'>内容</span>" }
    );

    expect(wrapper.find("[data-testid='preview-empty']").text()).toBe(
      "加载失败"
    );
    expect(wrapper.find("[data-testid='preview-content']").exists()).toBe(
      false
    );
  });

  it("风险提示渲染在脚注，铺满型舞台不带内边距", () => {
    const wrapper = mountPreview({
      note: "当前页不生效",
      noteTestid: "preview-note",
      padded: false,
      height: "200px"
    });

    expect(wrapper.find("[data-testid='preview-note']").text()).toBe(
      "当前页不生效"
    );
    const stage = wrapper.find(".setting-preview__stage");
    expect(stage.classes()).toContain("setting-preview__stage--plain");
    expect(stage.attributes("style")).toContain("height: 200px");
  });
});
