import { defineComponent, h, type Component } from "vue";

import { sanitizeSvgIcon } from "@/utils/sanitize";
import { FontIcon, IconifyIconOffline } from "../index";
import LocalIcon from "./localIcon";
import type { iconType } from "./types";

const ifReg = /^IF-/;
const svgReg = /^\s*<svg[\s>]/;
const imgReg = /^(https?:\/\/|\/\/|data:image\/)/;

/** SVG 字符串净化结果缓存（净化是纯函数，按原串命中即可） */
const svgCache = new Map<string, string>();
/** 渲染组件缓存：同 icon + 同 attrs 复用同一组件类型，避免表格逐格渲染重建图标子树 */
const componentCache = new Map<string, Component>();
const CACHE_LIMIT = 500;
const objectIdMap = new WeakMap<object, number>();
let objectIdSeq = 0;

/**
 * attrs 的缓存键：无法安全序列化（含函数 / 循环引用）时返回 null，
 * 调用方据此跳过缓存——宁可不复用，也不把带回调的图标错配给别的格子。
 */
function attrsKey(attrs?: iconType): string | null {
  if (!attrs) return "";
  if (typeof attrs !== "object") return null;
  if (Object.values(attrs).some(value => typeof value === "function")) {
    return null;
  }
  try {
    return JSON.stringify(attrs) ?? null;
  } catch {
    return null;
  }
}

/** 图标数据对象（iconify JSON）的身份 id（WeakMap，不阻止回收） */
function objectId(icon: object): number {
  const cached = objectIdMap.get(icon);
  if (cached !== undefined) return cached;
  const id = ++objectIdSeq;
  objectIdMap.set(icon, id);
  return id;
}

function cachedIcon(key: string, factory: () => Component): Component {
  const cached = componentCache.get(key);
  if (cached) return cached;
  if (componentCache.size >= CACHE_LIMIT) componentCache.clear();
  const component = factory();
  componentCache.set(key, component);
  return component;
}

/** 原 SVG 串：清掉写死的 width/height 后净化一次 */
function cleanedSvg(icon: string): string {
  const cached = svgCache.get(icon);
  if (cached !== undefined) return cached;
  if (svgCache.size > 200) svgCache.clear();
  const cleaned = sanitizeSvgIcon(
    icon.replace(
      /<svg([^>]*)>/,
      (_, attributes: string) =>
        `<svg${attributes.replace(/\s*(width|height)="[^"]*"/g, "")}>`
    )
  );
  svgCache.set(icon, cleaned);
  return cleaned;
}

/**
 * 按图标形态构建渲染组件（细节分支，缓存命中时直接复用组件类型）。
 *
 * attrs 在这里闭包捕获（与既有行为一致：调用时的属性快照）；
 * 若调用方传入含函数的 attrs 则不缓存，保证每次都是新的组件实例。
 */
export function resolveIconComponent(
  icon: string | Component | Record<string, unknown> | null | undefined,
  attrs?: iconType
): Component {
  const attrsCacheKey = attrsKey(attrs);
  const memo = (key: string, factory: () => Component): Component =>
    attrsCacheKey === null
      ? factory()
      : cachedIcon(`${key}|${attrsCacheKey}`, factory);

  // 后端菜单未配置图标时 icon 可能为 null/undefined（如按钮型菜单节点），
  // 空值直接按无图标渲染
  if (!icon) {
    return memo("empty", () =>
      defineComponent({ name: "EmptyIcon", render: () => null })
    );
  }
  if (typeof icon === "string" && svgReg.test(icon)) {
    const svg = cleanedSvg(icon);
    return memo(`svg|${icon}`, () =>
      defineComponent({
        name: "SvgRawIcon",
        render: () =>
          h("span", {
            class: "svg-raw-icon",
            innerHTML: svg,
            ...attrs
          })
      })
    );
  }
  if (typeof icon === "string" && imgReg.test(icon)) {
    return memo(`img|${icon}`, () =>
      defineComponent({
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
      })
    );
  }
  if (typeof icon === "string" && ifReg.test(icon)) {
    const name = icon.split(ifReg)[1];
    const spaceIdx = name.indexOf(" ");
    const iconName = spaceIdx === -1 ? name : name.slice(0, spaceIdx);
    const iconType = spaceIdx === -1 ? name : name.slice(spaceIdx + 1);
    return memo(`ifont|${icon}`, () =>
      defineComponent({
        name: "FontIcon",
        render: () => h(FontIcon, { icon: iconName, iconType, ...attrs })
      })
    );
  }
  if (
    typeof icon === "function" ||
    typeof (icon as { render?: unknown }).render === "function"
  ) {
    // SVG 函数组件：本身即稳定类型，无需包一层；带 attrs 时按 vnode 渲染
    const component = icon as Component;
    return (attrs ? h(component, { ...attrs }) : component) as Component;
  }
  if (typeof icon === "object") {
    const iconData = icon;
    return memo(`offline|${objectId(iconData)}`, () =>
      defineComponent({
        name: "OfflineIcon",
        render: () =>
          h(IconifyIconOffline, {
            icon: iconData,
            ...attrs
          } as Record<string, unknown>)
      })
    );
  }
  // 字符串图标：统一走本地解析（随包注册 + 本地图标集懒加载；不依赖在线图标 API）
  const iconName = icon as string;
  return memo(`name|${iconName}`, () =>
    defineComponent({
      name: "Icon",
      render: () =>
        h(
          LocalIcon as never,
          { icon: iconName, ...attrs } as Record<string, unknown>
        )
    })
  );
}
