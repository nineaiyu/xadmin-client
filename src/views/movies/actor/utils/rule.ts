import { reactive } from "vue";
import type { FormRules } from "element-plus";
import { $t, transformI18n } from "@/plugins/i18n";

/** 自定义表单规则校验 */
export const formRules = reactive(<FormRules>{
  name: [
    {
      required: true,
      message: transformI18n($t("MoviesActor.name")),
      trigger: "blur"
    }
  ],
  foreign_name: [
    {
      required: true,
      message: transformI18n($t("MoviesActor.foreignName")),
      trigger: "blur"
    }
  ],
  sex: [
    {
      required: true,
      message: transformI18n($t("user.gender")),
      trigger: "blur"
    }
  ],
  birthday: [
    {
      required: true,
      message: transformI18n($t("MoviesActor.birthday")),
      trigger: "blur"
    }
  ],
  introduction: [
    {
      required: true,
      message: transformI18n($t("MoviesActor.introduction")),
      trigger: "blur"
    }
  ]
});
