import { shallowRef } from "vue";
import { addCollection } from "@iconify/vue/dist/offline";

/**
 * 图标本地注册表 + 图标集懒加载（**前端离线化：不依赖任何在线图标 API**）。
 *
 * 背景：菜单/路由的图标名来自服务端元数据（`loadjson/menumeta.json` 等，形如
 * `ep:refrigerator`），用户还可在「菜单管理 → 图标选择器」里挑任意图标。此前
 * 这类带 `:` 的名字会走 `@iconify/vue` 的在线组件（本地缺失即请求
 * `api.iconify.design` 等镜像）——内网/离线部署下表现为菜单图标缺失、并产生
 * CSP 违规上报。本模块把图标来源收敛为「随包内置」：
 *
 * 1. **随包注册**（`offlineIcon.ts`）：种子与代码在用的图标，冒号/斜杠双形态同步注册；
 * 2. **按需懒加载**：其余图标按 set 前缀动态加载**构建期内置**的图标集
 *    （`@iconify/json`，与页面同源的同级 chunk；`pnpm build` 时打包进产物，
 *    不访问外网），加载完成即本地注册并触发重渲染；
 * 3. **绝不回退在线**：任何情况下都不发起外部请求；未内置的 set 只告警（DEV）。
 *
 * 可用性用 shallowRef 的 Set 承载：替换实例即触发依赖它的渲染重算。
 */

/** 图标集懒加载器（键 = 图标名前缀；数据来自构建期打包的 @iconify/json） */
const SET_LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
  ep: () => import("@iconify/json/json/ep.json"),
  ri: () => import("@iconify/json/json/ri.json"),
  "fa-solid": () => import("@iconify/json/json/fa-solid.json")
};

/** 已注册（可直接渲染）的图标名 */
const availableIcons = shallowRef<ReadonlySet<string>>(new Set());
/** 已加载完成的图标集前缀 */
const loadedIconSets = shallowRef<ReadonlySet<string>>(new Set());
const pendingSets = new Map<string, Promise<void>>();

export const supportedIconPrefixes = Object.keys(SET_LOADERS);

/** 登记图标可用（随包注册与懒加载完成后调用） */
export function markIconAvailable(...names: string[]) {
  const next = new Set(availableIcons.value);
  let changed = false;
  for (const name of names) {
    if (name && !next.has(name)) {
      next.add(name);
      changed = true;
    }
  }
  if (changed) availableIcons.value = next;
}

/** 图标是否可本地渲染（响应式：读取即建立依赖） */
export function isIconAvailable(name: string): boolean {
  return availableIcons.value.has(name);
}

/** 图标集是否已加载完成（供选择器等展示加载态） */
export function isIconSetLoaded(prefix: string): boolean {
  return loadedIconSets.value.has(prefix);
}

/** 前缀是否内置（未内置 = 无法离线渲染，仅 DEV 告警） */
export function isIconSetSupported(prefix: string): boolean {
  return prefix in SET_LOADERS;
}

/** 取图标名的 set 前缀（`ep:refrigerator` → `ep`；无冒号返回空串） */
export function iconPrefixOf(name: string): string {
  const index = name.indexOf(":");
  return index === -1 ? "" : name.slice(0, index);
}

/**
 * 懒加载并注册本地图标集（幂等）：
 * chunk 与页面同源（构建产物自带），加载失败保持未注册——不降级到在线请求。
 */
export function ensureIconSet(prefix: string): Promise<void> {
  if (!prefix || isIconSetLoaded(prefix) || !SET_LOADERS[prefix]) {
    return Promise.resolve();
  }
  const pending = pendingSets.get(prefix);
  if (pending) return pending;
  const task = SET_LOADERS[prefix]()
    .then(module => {
      const data = module.default as {
        icons?: Record<string, unknown>;
        aliases?: Record<string, unknown>;
      };
      addCollection(data as never);
      loadedIconSets.value = new Set([...loadedIconSets.value, prefix]);
      markIconAvailable(
        ...Object.keys(data.icons ?? {}).map(name => `${prefix}:${name}`),
        ...Object.keys(data.aliases ?? {}).map(name => `${prefix}:${name}`)
      );
    })
    .catch(() => {
      // 本地 chunk 加载失败（如产物不完整）：保持未注册，渲染空
    })
    .finally(() => pendingSets.delete(prefix));
  pendingSets.set(prefix, task);
  return task;
}
