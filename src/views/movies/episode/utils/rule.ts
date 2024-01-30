import { reactive } from "vue";
import type { FormRules } from "element-plus";
import { $t, transformI18n } from "@/plugins/i18n";

/** 自定义表单规则校验 */
export const formRules = reactive(<FormRules>{
  film: [
    {
      required: true,
      message: transformI18n($t("MoviesEpisode.film")),
      trigger: "blur"
    }
  ],
  rank: [
    {
      required: true,
      message: transformI18n($t("MoviesEpisode.rank")),
      trigger: "blur"
    }
  ],
  file_id: [
    {
      required: true,
      message: transformI18n($t("MoviesEpisode.uploadVideo")),
      trigger: "blur"
    }
  ]
});
