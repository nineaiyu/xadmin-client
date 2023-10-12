import { reactive } from "vue";
import type { FormRules } from "element-plus";
import { $t, transformI18n } from "@/plugins/i18n";

/** 自定义表单规则校验 */
export const formRules = reactive<FormRules>({
  owners: [
    {
      required: true,
      message: transformI18n($t("notice.verifyUserId")),
      trigger: "blur"
    }
  ],
  title: [
    {
      required: true,
      message: transformI18n($t("notice.verifyTitle")),
      trigger: "blur"
    }
  ],
  message: [
    {
      required: true,
      message: transformI18n($t("notice.verifyContent")),
      trigger: "blur"
    }
  ]
});
