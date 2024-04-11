import { reactive } from "vue";
import type { FormRules } from "element-plus";
import { $t, transformI18n } from "@/plugins/i18n";

export const formRules = reactive<FormRules>({
  name: [
    {
      required: true,
      message: transformI18n($t("systemDept.name")),
      trigger: "blur"
    }
  ],
  code: [
    {
      required: true,
      message: transformI18n($t("systemDept.code")),
      trigger: "blur"
    }
  ],
  rank: [
    {
      required: true,
      message: transformI18n($t("systemDept.rank")),
      trigger: "blur"
    }
  ]
});
