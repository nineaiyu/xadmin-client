import { reactive } from "vue";
import type { FormRules } from "element-plus";
import { $t, transformI18n } from "@/plugins/i18n";

/** 自定义表单规则校验 */
export const formRules = reactive(<FormRules>{
  name: [
    {
      required: true,
      message: transformI18n($t("MoviesSwipe.name")),
      trigger: "blur"
    }
  ],
  rank: [
    {
      required: true,
      message: transformI18n($t("MoviesSwipe.rank")),
      trigger: "blur"
    }
  ],
  route: [
    {
      validator: (rule, value, callback) => {
        if (value && value.startsWith("/")) {
          callback();
        } else {
          callback(new Error(transformI18n($t("menu.pathError"))));
        }
      },
      trigger: "blur"
    }
  ]
});
