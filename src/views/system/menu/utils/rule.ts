import { $t, transformI18n } from "@/plugins/i18n";

/** 路由地址校验（目录/菜单共用）：必须以 "/" 开头 */
const pathValidator = (
  _rule: unknown,
  value: string | undefined,
  callback: (error?: Error) => void
) => {
  if (value && value.startsWith("/")) {
    callback();
  } else {
    callback(new Error(transformI18n($t("systemMenu.pathError"))));
  }
};

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
      validator: pathValidator,
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
      validator: pathValidator,
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
