import { reactive } from "vue";
import type { FormRules } from "element-plus";
import { $t, transformI18n } from "@/plugins/i18n";

/** 自定义表单规则校验 */
export const formRules = reactive(<FormRules>{
  name: [
    {
      required: true,
      message: transformI18n($t("permission.name")),
      trigger: "blur"
    }
  ],
  mode_type: [
    {
      required: true,
      message: transformI18n($t("permission.mode")),
      trigger: "blur"
    }
  ],
  rules: [
    {
      required: true,
      message: transformI18n($t("permission.rules")),
      trigger: "blur"
    }
  ]
});
