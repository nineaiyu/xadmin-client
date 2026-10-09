import { h, type Ref } from "vue";
import { ElAutocomplete } from "element-plus";
import type { RegisteredConfigKey } from "@/api/system/config/system";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 注册配置键的表单提示（自 hook.tsx 抽出）：类型文案映射、键候选前缀过滤与
 * key 列自动补全渲染器。
 */

/** 注册键值类型 → 类型文案 key（未知类型按 string 处理） */
export function registeredTypeLabelKey(type: string): string {
  const labels: Record<string, string> = {
    boolean: "configSystem.typeBoolean",
    integer: "configSystem.typeInteger",
    number: "configSystem.typeNumber",
    string: "configSystem.typeString",
    array: "configSystem.typeArray",
    object: "configSystem.typeObject"
  };
  return labels[type] ?? labels.string;
}

/** 键候选过滤：按输入前缀匹配（大小写不敏感），空输入返回全量 */
export function filterRegisteredKeys(
  keys: RegisteredConfigKey[],
  query: string
): RegisteredConfigKey[] {
  const prefix = query.trim().toLowerCase();
  if (!prefix) return keys;
  return keys.filter(item => item.key.toLowerCase().startsWith(prefix));
}

/**
 * 表单 key 列渲染：自动补全注册键（候选展示键与期望类型），命中注册键时在
 * 输入框下方提示期望类型；自由输入未注册键仍可用。
 */
export function createConfigKeyRenderField({
  registeredKeys,
  t
}: {
  registeredKeys: Ref<RegisteredConfigKey[]>;
  t: TFunction;
}) {
  return (value: unknown, onChange: (val: unknown) => void) => {
    const current = value == null ? "" : String(value);
    const hit = registeredKeys.value.find(item => item.key === current);
    return h("div", { class: "w-full" }, [
      h(
        ElAutocomplete,
        {
          modelValue: current,
          "onUpdate:modelValue": (val: string | number) => onChange(val),
          fetchSuggestions: (query: string, cb) =>
            cb(
              filterRegisteredKeys(registeredKeys.value, query).map(item => ({
                value: item.key,
                label: t(registeredTypeLabelKey(item.type))
              }))
            ),
          hideLoading: true,
          class: "w-full"
        },
        {
          default: ({ item }: { item: { value: string; label: string } }) =>
            h("div", { class: "flex items-center justify-between gap-3" }, [
              h("span", { class: "truncate" }, item.value),
              h("span", { class: "text-xs opacity-60" }, item.label)
            ])
        }
      ),
      hit
        ? h(
            "div",
            { class: "text-xs leading-5 text-(--el-text-color-secondary)" },
            t("configSystem.registeredTypeTip", {
              type: t(registeredTypeLabelKey(hit.type))
            })
          )
        : null
    ]);
  };
}
