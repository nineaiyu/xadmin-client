// 多组件库的国际化和本地项目国际化兼容
import { createI18n, type Composer, type I18n } from "vue-i18n";
import type { App } from "vue";
import { responsiveStorageNameSpace } from "@/config";
import { isObject, storageLocal } from "@pureadmin/utils";

// element-plus国际化
import enLocale from "element-plus/es/locale/lang/en";
import zhLocale from "element-plus/es/locale/lang/zh-cn";

const siphonI18n = (function () {
  // 仅初始化一次国际化配置
  const cache = Object.fromEntries(
    Object.entries(
      import.meta.glob("../../locales/*.{yaml,yml}", { eager: true })
    ).map(([key, value]) => {
      // 语料文件名格式固定（zh-CN.yaml 等），未匹配到前缀时退回空串
      const matched = key.match(/([A-Za-z0-9-_]+)\./i)?.[1] ?? "";
      return [matched, (value as { default: Record<string, string> }).default];
    })
  );
  return (prefix = "zh-CN") => {
    return cache[prefix];
  };
})();

export const localesConfigs = {
  zh: {
    ...siphonI18n("zh-CN"),
    ...zhLocale
  },
  en: {
    ...siphonI18n("en"),
    ...enLocale
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

export function useI18n(app: App) {
  app.use(i18n);
}
