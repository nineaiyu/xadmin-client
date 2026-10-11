import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import ReResult from "../src/index.vue";

const mountResult = (props: Record<string, unknown> = {}, slots = {}) =>
  mount(ReResult, { props, slots });

const toneOf = (status: string) =>
  mountResult({ status })
    .find(".re-result")
    .classes()
    .find(cls => cls.startsWith("re-result--"));

describe("ReResult 通用结果态", () => {
  it("状态映射到色板：success / warning(403,404) / danger(500,offline,error) / info(coming-soon)", () => {
    expect(toneOf("success")).toBe("re-result--success");
    expect(toneOf("403")).toBe("re-result--warning");
    expect(toneOf("404")).toBe("re-result--warning");
    expect(toneOf("warning")).toBe("re-result--warning");
    expect(toneOf("500")).toBe("re-result--danger");
    expect(toneOf("offline")).toBe("re-result--danger");
    expect(toneOf("error")).toBe("re-result--danger");
    expect(toneOf("coming-soon")).toBe("re-result--info");
    expect(toneOf("info")).toBe("re-result--info");
  });

  it("默认渲染状态图标", () => {
    expect(mountResult({ status: "success" }).find("svg").exists()).toBe(true);
  });

  it("title / subTitle 渲染；缺省时不渲染对应节点", () => {
    const wrapper = mountResult({ title: "提交成功", subTitle: "已进入审批" });
    expect(wrapper.find(".re-result__title").text()).toBe("提交成功");
    expect(wrapper.find(".re-result__sub").text()).toBe("已进入审批");

    const bare = mountResult({});
    expect(bare.find(".re-result__title").exists()).toBe(false);
    expect(bare.find(".re-result__sub").exists()).toBe(false);
  });

  it("icon / title / subTitle / extra 插槽可覆盖或追加", () => {
    const wrapper = mountResult(
      { title: "忽略" },
      {
        icon: "<i class='custom-icon' />",
        title: "<span class='custom-title'>自定义标题</span>",
        subTitle: "<span class='custom-sub'>副标题插槽</span>",
        extra: "<button class='act'>返回</button>"
      }
    );
    expect(wrapper.find(".custom-icon").exists()).toBe(true);
    expect(wrapper.find(".custom-title").text()).toBe("自定义标题");
    expect(wrapper.find(".custom-sub").text()).toBe("副标题插槽");
    expect(wrapper.find(".re-result__extra .act").text()).toBe("返回");
  });

  it("默认插槽并入副标题区", () => {
    const wrapper = mountResult(
      {},
      { default: "<span class='body'>正文</span>" }
    );
    expect(wrapper.find(".re-result__sub .body").text()).toBe("正文");
  });
});
