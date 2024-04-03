import { reactive } from "vue";
import type { FormRules } from "element-plus";
import { $t, transformI18n } from "@/plugins/i18n";

/** 自定义表单规则校验 */
export const formRules = reactive<FormRules>({
  notice_user: [
    {
      required: true,
      message: transformI18n($t("user.verifyUserId")),
      trigger: "blur"
    }
  ],
  notice_dept: [
    {
      required: true,
      message: transformI18n($t("dept.dept")),
      trigger: "blur"
    }
  ],
  notice_role: [
    {
      required: true,
      message: transformI18n($t("role.role")),
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
  ],
  notice_type: [
    {
      required: true,
      message: transformI18n($t("notice.type")),
      trigger: "blur"
    }
  ]
});
