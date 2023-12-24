import { reactive } from "vue";
import type { FormRules } from "element-plus";
import { $t, transformI18n } from "@/plugins/i18n";

/** 自定义表单规则校验 */
export const formRules = reactive(<FormRules>{
  name: [
    {
      required: true,
      message: transformI18n($t("permission.addName")),
      trigger: "blur"
    }
  ],
  match: [
    {
      required: true,
      message: transformI18n($t("permission.addMatch")),
      trigger: "blur"
    }
  ],
  type: [
    {
      required: true,
      message: transformI18n($t("permission.addType")),
      trigger: "blur"
    }
  ],
  value: [
    {
      required: true,
      message: transformI18n($t("permission.addValue")),
      trigger: "blur"
    }
  ]
});
