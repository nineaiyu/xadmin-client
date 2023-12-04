import { reactive } from "vue";
import type { FormRules } from "element-plus";
import { $t, transformI18n } from "@/plugins/i18n";

/** 自定义表单规则校验 */
export const formRules = reactive(<FormRules>{
  name: [
    {
      required: true,
      message: transformI18n($t("MoviesCategory.name")),
      trigger: "blur"
    }
  ],
  rank: [
    {
      required: true,
      message: transformI18n($t("MoviesCategory.rank")),
      trigger: "blur"
    }
  ],
  category_type: [
    {
      required: true,
      message: transformI18n($t("MoviesCategory.categoryDisplay")),
      trigger: "blur"
    }
  ]
});
