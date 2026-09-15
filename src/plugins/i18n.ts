// 多组件库的国际化和本地项目国际化兼容
import { createI18n, type Composer, type I18n } from "vue-i18n";
import { watch, type App } from "vue";
import { responsiveStorageNameSpace } from "@/config";
import { isObject, storageLocal } from "@pureadmin/utils";

// element-plus 国际化（zh 随首屏；en 在 ensureLocale 内动态加载，避免进入首屏闭包）
import zhLocale from "element-plus/es/locale/lang/zh-cn";

// 语言包按需加载：zh-CN 是默认语言与源语言（transformI18n 的同步 key 探测依赖它），
// 随首屏 eager 加载；其余语言（en）在「初始语言为 en」或「切换到 en」时动态加载，
// 避免 en 语料（约 15 KB gzip）进入首屏闭包。
const eagerLocaleFiles = import.meta.glob("../../locales/zh-CN.{yaml,yml}", {
  eager: true
});
const lazyLocaleFiles = import.meta.glob([
  "../../locales/*.{yaml,yml}",
  "!../../locales/zh-CN.{yaml,yml}"
]);

const siphonI18n = (function () {
  // 仅初始化一次国际化配置
  const cache = Object.fromEntries(
    Object.entries(eagerLocaleFiles).map(([key, value]) => {
      // 语料文件名格式固定（zh-CN.yaml 等），未匹配到前缀时退回空串
      const matched = key.match(/([A-Za-z0-9-_]+)\./i)?.[1] ?? "";
      return [matched, (value as { default: Record<string, string> }).default];
    })
  );
  return (prefix = "zh-CN") => {
    return cache[prefix];
  };
})();

/** 读取 lazy glob 中的语料（按文件名精确匹配，形如 `../../locales/en.yaml`） */
async function loadLazyLocale(name: string) {
  const entry = Object.entries(lazyLocaleFiles).find(([key]) =>
    new RegExp(`/${name}\\.[a-z]+$`, "i").test(key)
  );
  if (!entry) return {};
  const mod = (await entry[1]()) as { default: Record<string, unknown> };
  return mod.default ?? {};
}

export const localesConfigs = {
  zh: {
    ...siphonI18n("zh-CN"),
    ...zhLocale
  }
};

/** 对象键展开栈元素（getObjectKeys 内部使用） */
type ObjectKeyStackItem = {
  obj: Record<string, unknown>;
  key: string;
};

/** 获取对象中所有嵌套对象的key键，并将它们用点号分割组成字符串 */
function getObjectKeys(obj: Record<string, unknown>) {
  const stack: ObjectKeyStackItem[] = [];
  const keys: Set<string> = new Set();

  stack.push({ obj, key: "" });

  while (stack.length > 0) {
    const item = stack.pop();
    if (!item) break;
    const { obj, key } = item;

    for (const k in obj) {
      const newKey = key ? `${key}.${k}` : k;
      const value = obj[k];

      if (value && isObject(value)) {
        stack.push({ obj: value, key: newKey });
      } else {
        keys.add(key);
      }
    }
  }

  return keys;
}

/** 将展开的key缓存 */
const keysCache: Map<string, Set<string>> = new Map();
const flatI18n = (prefix = "zh-CN") => {
  let cache = keysCache.get(prefix);
  if (!cache) {
    cache = getObjectKeys(siphonI18n(prefix));
    keysCache.set(prefix, cache);
  }
  return cache;
};

/**
 * 国际化转换工具函数（自动读取根目录locales文件夹下文件进行国际化匹配）
 * @param message message
 * @returns 转化后的message
 */
export function transformI18n(message: string | Record<string, string> = "") {
  if (!message) {
    return "";
  }

  // 处理存储动态路由的title,格式 {zh:"",en:""}
  if (typeof message === "object") {
    const locale = i18n.global.locale;
    const current = typeof locale === "string" ? locale : locale.value;
    return message[current];
  }

  const key = message.match(/(\S*)\./)?.input;

  // legacy: false 下 global 为 Composer（I18n 类型的 global 是 Composer | VueI18n 联合，此处收窄）
  const composer = i18n.global as Composer;

  if (key && flatI18n("zh-CN").has(key)) {
    return composer.t(message);
  } else if (!key && Object.hasOwn(siphonI18n("zh-CN"), message)) {
    // 兼容非嵌套形式的国际化写法
    return composer.t(message);
  } else {
    return message;
  }
}

/** 此函数只是配合i18n Ally插件来进行国际化智能提示，并无实际意义（只对提示起作用），如果不需要国际化可删除 */
export const $t = (key: string) => key;

export const i18n: I18n = createI18n({
  legacy: false,
  locale:
    storageLocal().getItem<StorageConfigs>(
      `${responsiveStorageNameSpace()}locale`
    )?.locale ?? "zh",
  fallbackLocale: "en",
  messages: localesConfigs
});

/**
 * 按需加载语言包（en 不随首屏闭包）。
 *
 * zh 为默认语言（eager 已就绪）；en 首次需要时动态加载 en.yaml + element-plus en locale
 * 并写入 i18n（setLocaleMessage）。调用点：app.mount 前（初始语言为 en 时）与语言切换处。
 */
let enLoaded = false;
export async function ensureLocale(locale?: string) {
  // legacy: false 下 global 为 Composer（I18n 类型的 locale 是 string | WritableComputedRef 联合，此处收窄）
  const rawLocale = i18n.global.locale;
  const current = typeof rawLocale === "string" ? rawLocale : rawLocale.value;
  const target = locale ?? String(current);
  if (target !== "en" || enLoaded) return;
  const [yaml, ep] = await Promise.all([
    loadLazyLocale("en"),
    import("element-plus/es/locale/lang/en")
  ]);
  (i18n.global as Composer).setLocaleMessage("en", {
    ...yaml,
    ...ep.default
  });
  enLoaded = true;
}

// 兜底：任何路径把 locale 切成 en（站点配置恢复、布局初始化等）时自动补齐语言包，
// 避免出现「locale=en 但 en 语料未加载」的 key 泄漏。
const localeRef = i18n.global.locale;
if (typeof localeRef !== "string") {
  watch(localeRef, value => {
    void ensureLocale(String(value));
  });
}

export function useI18n(app: App) {
  app.use(i18n);
}
