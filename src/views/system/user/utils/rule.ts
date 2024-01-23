import { reactive } from "vue";
import type { FormRules } from "element-plus";
import { $t, transformI18n } from "@/plugins/i18n";
import { isEmail, isPhone } from "@pureadmin/utils";
import { REGEXP_PWD } from "@/views/login/utils/rule";

/** 自定义表单规则校验 */
export const formRules = reactive<FormRules>({
  username: [
    {
      required: true,
      message: transformI18n($t("user.verifyUsername")),
      trigger: "blur"
    }
  ],
  password: [
    {
      required: true,
      validator: (rule, value, callback) => {
        if (value === "") {
          callback(new Error(transformI18n($t("login.passwordReg"))));
        } else if (!REGEXP_PWD.test(value)) {
          callback(new Error(transformI18n($t("login.passwordRuleReg"))));
        } else {
          callback();
        }
      },
      trigger: "blur"
    }
  ],
  nickname: [
    {
      required: true,
      message: transformI18n($t("user.verifyNickname")),
      trigger: "blur"
    }
  ],
  gender: [
    {
      required: true,
      message: transformI18n($t("user.verifyGender")),
      trigger: "blur"
    }
  ],
  dept: [
    {
      required: true,
      message: transformI18n($t("user.dept")),
      trigger: "blur"
    }
  ],
  is_active: [
    {
      required: true,
      message: transformI18n($t("labels.verifyStatus")),
      trigger: "blur"
    }
  ],
  mobile: [
    {
      validator: (rule, value, callback) => {
        if (value === "") {
          callback();
        } else if (!isPhone(value)) {
          callback(new Error(transformI18n($t("login.phoneCorrectReg"))));
        } else {
          callback();
        }
      },
      trigger: "blur"
    }
  ],
  email: [
    {
      validator: (rule, value, callback) => {
        if (value === "") {
          callback();
        } else if (!isEmail(value)) {
          callback(new Error(transformI18n($t("login.emailCorrectReg"))));
        } else {
          callback();
        }
      },
      trigger: "blur"
    }
  ]
});
