import { reactive } from "vue";
import type { FormRules } from "element-plus";
import { $t, transformI18n } from "@/plugins/i18n";

/** 自定义表单规则校验 */
export const formRules = reactive(<FormRules>{
  name: [
    {
      required: true,
      message: transformI18n($t("MoviesFilm.name")),
      trigger: "blur"
    }
  ],
  title: [
    {
      required: true,
      message: transformI18n($t("MoviesFilm.title")),
      trigger: "blur"
    }
  ],
  category: [
    {
      required: true,
      message: transformI18n($t("MoviesFilm.category")),
      trigger: "blur"
    }
  ],
  channel: [
    {
      required: true,
      message: transformI18n($t("MoviesFilm.channel")),
      trigger: "blur"
    }
  ],
  director: [
    {
      required: true,
      message: transformI18n($t("MoviesFilm.director")),
      trigger: "blur"
    }
  ],
  rate: [
    {
      required: true,
      message: transformI18n($t("MoviesFilm.rate")),
      trigger: "blur"
    }
  ],
  starring: [
    {
      required: true,
      message: transformI18n($t("MoviesFilm.starring")),
      trigger: "blur"
    }
  ],
  subtitle: [
    {
      required: true,
      message: transformI18n($t("MoviesFilm.subtitle")),
      trigger: "blur"
    }
  ],
  language: [
    {
      required: true,
      message: transformI18n($t("MoviesFilm.language")),
      trigger: "blur"
    }
  ],
  times: [
    {
      required: true,
      message: transformI18n($t("MoviesFilm.times")),
      trigger: "blur"
    }
  ],
  release_date: [
    {
      required: true,
      message: transformI18n($t("MoviesFilm.releaseDate")),
      trigger: "blur"
    }
  ],
  introduction: [
    {
      required: true,
      message: transformI18n($t("MoviesFilm.introduction")),
      trigger: "blur"
    }
  ],
  region: [
    {
      required: true,
      message: transformI18n($t("MoviesFilm.region")),
      trigger: "blur"
    }
  ]
});
