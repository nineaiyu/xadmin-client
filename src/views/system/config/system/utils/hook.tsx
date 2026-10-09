import { useI18n } from "vue-i18n";
import {
  systemConfigApi,
  type RegisteredConfigKey
} from "@/api/system/config/system";
import { onMounted, reactive, ref, type Ref } from "vue";
import type { PageColumn, RePlusPageProps } from "@/components/RePlusPage";
import { SUCCESS_CODE } from "@/api/types";
import { useConfigPage } from "../../useConfigPage";
import { createConfigKeyRenderField } from "./configKeyHints";

export { filterRegisteredKeys, registeredTypeLabelKey } from "./configKeyHints";

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

  /** key 列渲染（自动补全 + 期望类型提示）见 configKeyHints.ts */
  const baseColumnsFormat: RePlusPageProps["baseColumnsFormat"] = ({
    addOrEditColumns
  }) => {
    addOrEditColumns.value.forEach((column: PageColumn) => {
      if (column._column?.key !== "key") return;
      column.renderField = createConfigKeyRenderField({
        registeredKeys,
        t
      }) as PageColumn["renderField"];
    });
  };

  return {
    api,
    auth,
    baseColumnsFormat,
    operationButtonsProps
  };
}
