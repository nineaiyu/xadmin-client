import { reactive } from "vue";
import type { FormRules } from "element-plus";
import { $t, transformI18n } from "@/plugins/i18n";

/** 自定义表单规则校验 */
export const formRules = reactive(<FormRules>{
  owner: [
    {
      required: true,
      message: transformI18n($t("user.userId")),
      trigger: "blur"
    }
  ],
  key: [
    {
      required: true,
      message: transformI18n($t("configUser.key")),
      trigger: "blur"
    }
  ],
  value: [
    {
      required: true,
      message: transformI18n($t("configUser.value")),
      trigger: "blur"
    }
  ]
});
