import { useI18n } from "vue-i18n";
import {
  systemConfigApi,
  type RegisteredConfigKey
} from "@/api/system/config/system";
import { h, onMounted, reactive, ref, type Ref } from "vue";
import type { PageColumn, RePlusPageProps } from "@/components/RePlusPage";
import { SUCCESS_CODE } from "@/api/types";
import { ElAutocomplete } from "element-plus";
import { useConfigPage } from "../../useConfigPage";

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

export function useSystemConfig(tableRef: Ref) {
  const { t } = useI18n();

  const api = reactive(systemConfigApi);

  // 权限表与「清除缓存」行内按钮由配置页共用壳装配（invalid:SystemConfig）
  const { auth, operationButtonsProps } = useConfigPage({
    t,
    api,
    tableRef,
    invalidText: t("configSystem.invalidCache"),
    invalidConfirmTitle: t("configSystem.confirmInvalid")
  });

  /** 注册配置键枚举（表单增强提示用）：拉取失败静默降级为无候选，
   *  不阻断配置列表/编辑主流程 */
  const registeredKeys = ref<RegisteredConfigKey[]>([]);

  onMounted(() => {
    systemConfigApi
      .registeredKeys()
      .then(res => {
        if (res.code === SUCCESS_CODE && Array.isArray(res.data?.keys)) {
          registeredKeys.value = res.data.keys;
        }
      })
      .catch(() => undefined);
  });

  /** 表单 key 列渲染：自动补全注册键（候选展示键与期望类型），
   *  命中注册键时在输入框下方提示期望类型；自由输入未注册键仍可用 */
  const baseColumnsFormat: RePlusPageProps["baseColumnsFormat"] = ({
    addOrEditColumns
  }) => {
    addOrEditColumns.value.forEach((column: PageColumn) => {
      if (column._column?.key !== "key") return;
      column.renderField = (value, onChange) => {
        const current = value == null ? "" : String(value);
        const hit = registeredKeys.value.find(item => item.key === current);
        return h("div", { class: "w-full" }, [
          h(
            ElAutocomplete,
            {
              modelValue: current,
              "onUpdate:modelValue": val => onChange(val),
              fetchSuggestions: (query, cb) =>
                cb(
                  filterRegisteredKeys(registeredKeys.value, query).map(
                    item => ({
                      value: item.key,
                      label: t(registeredTypeLabelKey(item.type))
                    })
                  )
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
    });
  };

  return {
    api,
    auth,
    baseColumnsFormat,
    operationButtonsProps
  };
}
