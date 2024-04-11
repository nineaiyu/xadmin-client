import { reactive } from "vue";
import type { FormRules } from "element-plus";
import { $t, transformI18n } from "@/plugins/i18n";
import { isEmail, isPhone } from "@pureadmin/utils";
import { REGEXP_PWD } from "@/views/login/utils/rule";

export const formRules = reactive<FormRules>({
  username: [
    {
      required: true,
      message: transformI18n($t("systemUser.username")),
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
      message: transformI18n($t("systemUser.nickname")),
      trigger: "blur"
    }
  ],
  gender: [
    {
      required: true,
      message: transformI18n($t("systemUser.gender")),
      trigger: "blur"
    }
  ],
  dept: [
    {
      required: true,
      message: transformI18n($t("systemUser.dept")),
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
        if (value === "" || !value) {
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
        if (value === "" || !value) {
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
