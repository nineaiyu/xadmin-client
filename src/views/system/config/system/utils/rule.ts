import { reactive } from "vue";
import type { FormRules } from "element-plus";
import { $t, transformI18n } from "@/plugins/i18n";

/** 自定义表单规则校验 */
export const formRules = reactive(<FormRules>{
  key: [
    {
      required: true,
      message: transformI18n($t("configSystem.key")),
      trigger: "blur"
    }
  ],
  value: [
    {
      required: true,
      message: transformI18n($t("configSystem.value")),
      trigger: "blur"
    }
  ]
});
