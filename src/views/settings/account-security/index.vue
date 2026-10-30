<script lang="ts" setup>
// 系统设置 → 账号安全：注册、找回密码、密码规则、账号绑定与邮件/短信验证码。
import {
  settingsBindEmailApi,
  settingsBindPhoneApi,
  settingsPasswordApi,
  settingsRegisterAuthApi,
  settingsResetPasswordCodeApi,
  settingsVerifyCodeApi
} from "@/api/system/settings";
import Setting from "@/views/settings/components/settings-shell/index.vue";
import type { settingsPane } from "@/views/settings/components/settings-shell/types";
import { settingAuth } from "@/views/settings/utils/settingAuth";

defineOptions({
  name: "SettingAccountSecurity"
});

const panes: Array<settingsPane> = [
  {
    key: "register",
    item: {
      auth: settingAuth("SecurityRegisterAuth"),
      api: settingsRegisterAuthApi,
      localeName: "settingAccountSecurity",
      title: "register"
    }
  },
  {
    key: "resetPassword",
    item: {
      auth: settingAuth("SecurityResetPasswordAuth"),
      api: settingsResetPasswordCodeApi,
      localeName: "settingAccountSecurity",
      title: "resetPassword"
    }
  },
  {
    key: "passwordRule",
    item: {
      auth: settingAuth("SecurityPasswordRule"),
      api: settingsPasswordApi,
      localeName: "settingAccountSecurity",
      title: "passwordRule"
    }
  },
  {
    key: "bindEmail",
    item: {
      auth: settingAuth("SecurityBindEmailAuth"),
      api: settingsBindEmailApi,
      localeName: "settingAccountSecurity",
      title: "bindEmail"
    }
  },
  {
    key: "bindPhone",
    item: {
      auth: settingAuth("SecurityBindPhoneAuth"),
      api: settingsBindPhoneApi,
      localeName: "settingAccountSecurity",
      title: "bindPhone"
    }
  },
  {
    key: "verifyCode",
    item: {
      auth: settingAuth("SecurityVerifyCode"),
      api: settingsVerifyCodeApi,
      localeName: "settingAccountSecurity",
      title: "verifyCode"
    }
  }
];
</script>

<template>
  <setting :panes="panes" />
</template>
