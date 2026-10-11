import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";

import { useRenderIcon } from "../src/hooks";

/**
 * useRenderIcon 是图标渲染的唯一入口（离线图标体系）：这里按分支核对
 * 「空值 / SVG 字符串（含尺寸清理）/ 图片 URL / 函数组件 / 图标数据对象」，
 * 字符串名走 LocalIcon（在线能力已移除，渲染失败即本地缺图标，不回落网络）。
 */
describe("useRenderIcon 图标渲染分支", () => {
  it("空值按无图标渲染，不抛错", () => {
    const Empty = useRenderIcon("");
    const wrapper = mount(Empty as never);
    expect(wrapper.text()).toBe("");
  });

  it("SVG 字符串：清掉 width/height，落在 .svg-raw-icon 容器内", () => {
    const Raw = useRenderIcon(
      '<svg width="40" height="40" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>'
    );
    const wrapper = mount(Raw as never);
    const html = wrapper.find(".svg-raw-icon").html();
    expect(html).toContain("<svg");
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).not.toContain('width="40"');
    expect(html).not.toContain('height="40"');
  });

  it("SVG 字符串命中缓存：同串二次渲染结果一致", () => {
    const svg = '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="4"/></svg>';
    const first = mount(useRenderIcon(svg) as never).html();
    const second = mount(useRenderIcon(svg) as never).html();
    expect(second).toBe(first);
  });

  it("图片 URL：渲染 <img> 并透传 attrs", () => {
    const Img = useRenderIcon("https://example.com/a.png", {
      style: { width: "12px" }
    });
    const wrapper = mount(Img as never);
    const img = wrapper.find("img");
    expect(img.attributes("src")).toBe("https://example.com/a.png");
    expect(img.attributes("style")).toContain("width: 12px");
  });

  it("函数组件：原样返回（带 attrs 时包一层并透传）", () => {
    const Raw = defineComponent({
      name: "RawSvg",
      render: () => h("span", { class: "raw-svg" })
    });
    expect(useRenderIcon(Raw)).toBe(Raw);
    const withAttrs = mount(useRenderIcon(Raw, { color: "red" }) as never);
    expect(withAttrs.find(".raw-svg").exists()).toBe(true);
    expect(withAttrs.find(".raw-svg").attributes("color")).toBe("red");
  });

  it("图标数据对象：走离线 Iconify 分支（不依赖在线 API）", () => {
    const iconData = {
      body: '<path d="M0 0h24v24H0z"/>',
      width: 24,
      height: 24
    };
    const Offline = useRenderIcon(iconData) as { name?: string };
    expect(Offline.name).toBe("OfflineIcon");
    expect(() => mount(Offline as never)).not.toThrow();
  });
});
