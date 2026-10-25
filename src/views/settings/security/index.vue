<script lang="ts" setup>
import {
  settingsBindEmailApi,
  settingsBindPhoneApi,
  settingsBlockIpApi,
  settingsCaptchaApi,
  settingsLoginAuthApi,
  settingsLoginLimitApi,
  settingsMfaApi,
  settingsPasswordApi,
  settingsRegisterAuthApi,
  settingsResetPasswordCodeApi,
  settingsVerifyCodeApi
} from "@/api/system/settings";
import { computed, ref } from "vue";
import { hasAuth } from "@/router/utils";
import Setting from "@/views/settings/components/settings-shell/index.vue";
import { settingsPane } from "@/views/settings/components/settings-shell/types";
import { settingAuth } from "@/views/settings/utils/settingAuth";

import { useI18n } from "vue-i18n";

defineOptions({
  name: "SettingSecurity"
});

/** 面板键取各配置域标题（code/captcha/...），与 i18n 片段一一对应 */
const settingData = computed<Array<settingsPane>>(() => [
  {
    key: "code",
    item: {
      auth: settingAuth("SecurityVerifyCode"),
      api: settingsVerifyCodeApi,
      localeName: "settingSecurity",
      title: "code"
    }
  },
  {
    key: "captcha",
    item: {
      auth: settingAuth("SecurityCaptchaCode"),
      api: settingsCaptchaApi,
      localeName: "settingSecurity",
      title: "captcha"
    }
  },
  {
    key: "login",
    item: {
      auth: settingAuth("SecurityLoginAuth"),
      api: settingsLoginAuthApi,
      localeName: "settingSecurity",
      title: "login"
    }
  },
  {
    key: "limit",
    item: {
      auth: settingAuth("SecurityLoginLimit"),
      api: settingsLoginLimitApi,
      localeName: "settingSecurity",
      title: "limit"
    }
  },
  {
    key: "mfa",
    item: {
      auth: settingAuth("SecurityMFA"),
      api: settingsMfaApi,
      localeName: "settingSecurity",
      title: "mfa"
    }
  },
  {
    key: "register",
    item: {
      auth: settingAuth("SecurityRegisterAuth"),
      api: settingsRegisterAuthApi,
      localeName: "settingSecurity",
      title: "register"
    }
  },
  {
    key: "resetPassword",
    item: {
      auth: settingAuth("SecurityResetPasswordAuth"),
      api: settingsResetPasswordCodeApi,
      localeName: "settingSecurity",
      title: "resetPassword"
    }
  },
  {
    key: "passwordRule",
    item: {
      auth: settingAuth("SecurityPasswordRule"),
      api: settingsPasswordApi,
      localeName: "settingSecurity",
      title: "passwordRule"
    }
  },
  {
    key: "bindEmail",
    item: {
      auth: settingAuth("SecurityBindEmailAuth"),
      api: settingsBindEmailApi,
      localeName: "settingSecurity",
      title: "bindEmail"
    }
  },
  {
    key: "bindPhone",
    item: {
      auth: settingAuth("SecurityBindPhoneAuth"),
      api: settingsBindPhoneApi,
      localeName: "settingSecurity",
      title: "bindPhone"
    }
  }
]);
const auth = ref({
  list: hasAuth("list:SecurityBlockIp"),
  destroy: hasAuth("destroy:SecurityBlockIp"),
  batchDestroy: hasAuth("batchDestroy:SecurityBlockIp")
});
const api = ref(settingsBlockIpApi);
const { t } = useI18n();

/** 登录拦截 IP：列表型自定义面板，仅在有列表权限时并入导航 */
const panes = computed<Array<settingsPane>>(() => [
  ...settingData.value,
  ...(auth.value.list
    ? [{ key: "blockIp", label: t("settingSecurity.blockIp") }]
    : [])
]);
</script>

<template>
  <setting :panes="panes">
    <template #blockIp>
      <RePlusPage
        :api="api"
        :auth="auth"
        locale-name="settingSecurity"
        :fetch-search-fields="false"
        :pureTableProps="{
          adaptiveConfig: { offsetBottom: 160 }
        }"
      />
    </template>
  </setting>
</template>
