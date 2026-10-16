import type { iconType } from "./types";
import { h, defineComponent, type Component } from "vue";
import { FontIcon, IconifyIconOffline } from "../index";
import LocalIcon from "./localIcon";

const ifReg = /^IF-/;
const svgReg = /^\s*<svg[\s>]/;
const svgCache = new Map<string, string>();
const imgReg = /^(https?:\/\/|\/\/|data:image\/)/;

/**
 * 支持 `iconfont`、`SVG` 字符串、`SVG` 函数组件、图片 `URL` 以及 `iconify` 中所有的图标
 * @see 点击查看文档图标篇 {@link https://pure-admin.cn/pages/icon/}
 * @param icon 必传 图标（字符串 / 组件 / 图标数据对象）
 * @param attrs 可选 iconType 属性
 * @returns Component
 */
export function useRenderIcon(
  icon: string | Component | Record<string, unknown>,
  attrs?: iconType
): Component {
  // 后端菜单未配置图标时 icon 可能为 null/undefined（如按钮型菜单节点），
  // 空值直接按无图标渲染，避免下方 render 探测读取 null 属性报错
  if (!icon) {
    return defineComponent({
      name: "EmptyIcon",
      render: () => null
    });
  }
  if (typeof icon === "string" && svgReg.test(icon)) {
    // SVG 字符串
    let cleanedSvg = svgCache.get(icon);
    if (cleanedSvg === undefined) {
      if (svgCache.size > 200) svgCache.clear();
      cleanedSvg = icon.replace(
        /<svg([^>]*)>/,
        (_, a) => `<svg${a.replace(/\s*(width|height)="[^"]*"/g, "")}>`
      );
      svgCache.set(icon, cleanedSvg);
    }
    return defineComponent({
      name: "SvgRawIcon",
      render: () =>
        h("span", {
          class: "svg-raw-icon",
          innerHTML: cleanedSvg,
          ...attrs
        })
    });
  } else if (typeof icon === "string" && imgReg.test(icon)) {
    // 图片 URL
    return defineComponent({
      name: "ImgIcon",
      render: () =>
        h("img", {
          src: icon,
          style: {
            width: "18px",
            height: "18px",
            minWidth: "18px",
            objectFit: "contain"
          },
          ...attrs
        })
    });
  } else if (typeof icon === "string" && ifReg.test(icon)) {
    // iconfont
    const name = icon.split(ifReg)[1];
    const spaceIdx = name.indexOf(" ");
    const iconName = spaceIdx === -1 ? name : name.slice(0, spaceIdx);
    const iconType = spaceIdx === -1 ? name : name.slice(spaceIdx + 1);
    return defineComponent({
      name: "FontIcon",
      render() {
        return h(FontIcon, {
          icon: iconName,
          iconType,
          ...attrs
        });
      }
    });
  } else if (
    typeof icon === "function" ||
    typeof (icon as { render?: unknown }).render === "function"
  ) {
    // SVG 函数组件
    const comp = icon as Component;
    return attrs ? h(comp, { ...attrs }) : comp;
  } else if (typeof icon === "object") {
    return defineComponent({
      name: "OfflineIcon",
      render() {
        return h(IconifyIconOffline, {
          icon: icon,
          ...attrs
        } as Record<string, unknown>);
      }
    });
  } else {
    // 字符串图标：统一走本地解析（随包注册 + 本地图标集懒加载；不依赖在线图标 API）
    return defineComponent({
      name: "Icon",
      render() {
        if (!icon) return;
        return h(
          LocalIcon as never,
          {
            icon,
            ...attrs
          } as Record<string, unknown>
        );
      }
    });
  }
}
