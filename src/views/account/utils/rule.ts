import { reactive } from "vue";
import type { FormRules } from "element-plus";
import { $t, transformI18n } from "@/plugins/i18n";

/** 自定义表单规则校验 */
export const formRules = reactive<FormRules>({
  username: [
    {
      required: true,
      message: transformI18n($t("userinfo.username")),
      trigger: "blur"
    }
  ],
  nickname: [
    {
      required: true,
      message: transformI18n($t("userinfo.nickname")),
      trigger: "blur"
    }
  ],
  gender: [
    {
      required: true,
      message: transformI18n($t("userinfo.gender")),
      trigger: "blur"
    }
  ]
});
