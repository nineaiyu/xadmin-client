import { reactive } from "vue";
import type { FormRules } from "element-plus";
import { $t, transformI18n } from "@/plugins/i18n";

/** 自定义表单规则校验 */
export const formRules = reactive<FormRules>({
  name: [
    {
      required: true,
      message: transformI18n($t("dept.name")),
      trigger: "blur"
    }
  ],
  code: [
    {
      required: true,
      message: transformI18n($t("dept.code")),
      trigger: "blur"
    }
  ],
  rank: [
    {
      required: true,
      message: transformI18n($t("dept.rank")),
      trigger: "blur"
    }
  ],
  is_active: [
    {
      required: true,
      message: transformI18n($t("labels.verifyStatus")),
      trigger: "blur"
    }
  ]
});
