import {
  systemConfigApi,
  type RegisteredConfigKey
} from "@/api/system/config/system";
import { onMounted, ref } from "vue";
import {
  defineListPage,
  type PageColumn,
  type RePlusPageProps
} from "@/components/RePlusPage";
import { isSuccess } from "@/api/types";
import { message } from "@/utils/message";
import { normalizeError } from "@/utils/apiError";
import { useConfigPage } from "../../useConfigPage";
import { createConfigKeyRenderField } from "./configKeyHints";

export { filterRegisteredKeys, registeredTypeLabelKey } from "./configKeyHints";

export function useSystemConfig() {
  // 权限表与「清除缓存」行内按钮由配置页共用壳装配（invalid:SystemConfig）
  const page = defineListPage({
    api: systemConfigApi,
    localeName: "configSystem",
    extraAuth: ["invalid"],
    buttons: ({ t, api, auth, tableRef }) =>
      useConfigPage({
        t,
        api,
        auth,
        tableRef,
        invalidText: t("configSystem.invalidCache"),
        invalidConfirmTitle: t("configSystem.confirmInvalid")
      })
  });
  const { t, api } = page;

  /** 注册配置键枚举（表单增强提示用）：失败可重试，不阻断配置列表/编辑主流程 */
  const registeredKeys = ref<RegisteredConfigKey[]>([]);
  const registeredKeysLoading = ref(false);
  const registeredKeysFailed = ref(false);

  const loadRegisteredKeys = async () => {
    if (registeredKeysLoading.value) return;
    registeredKeysLoading.value = true;
    registeredKeysFailed.value = false;
    const res = await api.registeredKeys().catch(normalizeError);
    registeredKeysLoading.value = false;
    if (isSuccess(res) && Array.isArray(res.data?.keys)) {
      registeredKeys.value = res.data.keys;
      return;
    }
    registeredKeysFailed.value = true;
    message(String(res.detail || t("configSystem.registeredKeysLoadFailed")), {
      type: "warning"
    });
  };

  onMounted(loadRegisteredKeys);

  /** key 列渲染（自动补全 + 期望类型提示）见 configKeyHints.ts */
  const baseColumnsFormat: RePlusPageProps["baseColumnsFormat"] = ({
    addOrEditColumns
  }) => {
    // 表单每次打开时重试一次：注册键可能在上次失败后恢复
    if (!registeredKeys.value.length) loadRegisteredKeys();
    addOrEditColumns.value.forEach((column: PageColumn) => {
      if (column._column?.key !== "key") return;
      column.renderField = createConfigKeyRenderField({
        registeredKeys,
        t
      }) as PageColumn["renderField"];
    });
  };

  return { ...page, baseColumnsFormat };
}
