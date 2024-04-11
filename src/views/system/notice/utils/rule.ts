import { reactive } from "vue";
import type { FormRules } from "element-plus";
import { $t, transformI18n } from "@/plugins/i18n";

/** 自定义表单规则校验 */
export const formRules = reactive<FormRules>({
  notice_user: [
    {
      required: true,
      message: transformI18n($t("systemNotice.notice_user")),
      trigger: "blur"
    }
  ],
  notice_dept: [
    {
      required: true,
      message: transformI18n($t("systemNotice.notice_dept")),
      trigger: "blur"
    }
  ],
  notice_role: [
    {
      required: true,
      message: transformI18n($t("systemNotice.notice_role")),
      trigger: "blur"
    }
  ],
  title: [
    {
      required: true,
      message: transformI18n($t("systemNotice.title")),
      trigger: "blur"
    }
  ],
  message: [
    {
      required: true,
      message: transformI18n($t("systemNotice.message")),
      trigger: "blur"
    }
  ],
  notice_type: [
    {
      required: true,
      message: transformI18n($t("systemNotice.notice_type")),
      trigger: "blur"
    }
  ]
});
