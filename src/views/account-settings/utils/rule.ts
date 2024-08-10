import { reactive } from "vue";
import type { FormRules } from "element-plus";
import { $t, transformI18n } from "@/plugins/i18n";
import { isEmail, isPhone } from "@pureadmin/utils";

/** 自定义表单规则校验 */
export const formRules = reactive<FormRules>({
  username: [
    {
      required: true,
      message: transformI18n($t("userinfo.username")),
      trigger: "blur"
    }
  ],
  password: [
    {
      required: true,
      message: transformI18n($t("userinfo.verifyPassword")),
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
