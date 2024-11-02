import { $t, transformI18n } from "@/plugins/i18n";

export const dirFormRules = {
  menu_type: [
    {
      required: true,
      message: transformI18n($t("systemMenu.verifyType")),
      trigger: "change"
    }
  ],
  title: [
    {
      required: true,
      message: transformI18n($t("systemMenu.verifyTitle")),
      trigger: "blur"
    }
  ],
  path: [
    {
      required: true,
      message: transformI18n($t("systemMenu.verifyPath")),
      trigger: "blur"
    },
    {
      validator: (rule, value, callback) => {
        if (value && value.startsWith("/")) {
          callback();
        } else {
          callback(new Error(transformI18n($t("systemMenu.pathError"))));
        }
      },
      trigger: "blur"
    }
  ]
};
export const menuFormRules = {
  menu_type: [
    {
      required: true,
      message: transformI18n($t("systemMenu.verifyType")),
      trigger: "change"
    }
  ],
  title: [
    {
      required: true,
      message: transformI18n($t("systemMenu.verifyTitle")),
      trigger: "blur"
    }
  ],
  path: [
    {
      required: true,
      message: transformI18n($t("systemMenu.verifyPath")),
      trigger: "blur"
    },
    {
      validator: (rule, value, callback) => {
        if (value && value.startsWith("/")) {
          callback();
        } else {
          callback(new Error(transformI18n($t("systemMenu.pathError"))));
        }
      },
      trigger: "blur"
    }
  ],
  component: [
    {
      required: true,
      message: transformI18n($t("systemMenu.verifyComponentPath")),
      trigger: "blur"
    }
  ]
};
export const permissionFormRules = {
  menu_type: [
    {
      required: true,
      message: transformI18n($t("systemMenu.verifyType")),
      trigger: "change"
    }
  ],
  title: [
    {
      required: true,
      message: transformI18n($t("systemMenu.verifyPermissionName")),
      trigger: "blur"
    }
  ],
  name: [
    {
      required: true,
      message: transformI18n($t("systemMenu.verifyPermissionCode")),
      trigger: "blur"
    }
  ],
  path: [
    {
      required: true,
      message: transformI18n($t("systemMenu.verifyPath")),
      trigger: "blur"
    }
  ],
  method: [
    {
      required: true,
      message: transformI18n($t("systemMenu.verifyRequestMethod")),
      trigger: "blur"
    }
  ]
};
