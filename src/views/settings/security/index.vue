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
import Setting from "@/views/settings/components/settings/index.vue";
import { settingItemProps } from "@/views/settings/components/settings/types";
import { settingAuth } from "@/views/settings/utils/settingAuth";

import { useI18n } from "vue-i18n";

defineOptions({
  name: "SettingSecurity"
});

const settingData = computed<Array<settingItemProps>>(() => [
  {
    auth: settingAuth("SecurityVerifyCode"),
    api: settingsVerifyCodeApi,
    localeName: "settingSecurity",
    title: "code"
  },
  {
    auth: settingAuth("SecurityCaptchaCode"),
    api: settingsCaptchaApi,
    localeName: "settingSecurity",
    title: "captcha"
  },
  {
    auth: settingAuth("SecurityLoginAuth"),
    api: settingsLoginAuthApi,
    localeName: "settingSecurity",
    title: "login"
  },
  {
    auth: settingAuth("SecurityLoginLimit"),
    api: settingsLoginLimitApi,
    localeName: "settingSecurity",
    title: "limit"
  },
  {
    auth: settingAuth("SecurityMFA"),
    api: settingsMfaApi,
    localeName: "settingSecurity",
    title: "mfa"
  },
  {
    auth: settingAuth("SecurityRegisterAuth"),
    api: settingsRegisterAuthApi,
    localeName: "settingSecurity",
    title: "register"
  },
  {
    auth: settingAuth("SecurityResetPasswordAuth"),
    api: settingsResetPasswordCodeApi,
    localeName: "settingSecurity",
    title: "resetPassword"
  },
  {
    auth: settingAuth("SecurityPasswordRule"),
    api: settingsPasswordApi,
    localeName: "settingSecurity",
    title: "passwordRule"
  },
  {
    auth: settingAuth("SecurityBindEmailAuth"),
    api: settingsBindEmailApi,
    localeName: "settingSecurity",
    title: "bindEmail"
  },
  {
    auth: settingAuth("SecurityBindPhoneAuth"),
    api: settingsBindPhoneApi,
    localeName: "settingSecurity",
    title: "bindPhone"
  }
]);
const auth = ref({
  list: hasAuth("list:SecurityBlockIp"),
  destroy: hasAuth("destroy:SecurityBlockIp"),
  batchDestroy: hasAuth("batchDestroy:SecurityBlockIp")
});
const api = ref(settingsBlockIpApi);
const { t } = useI18n();
</script>

<template>
  <setting :model-value="settingData">
    <el-tab-pane
      v-if="auth.list"
      :label="t('settingSecurity.blockIp')"
      :lazy="true"
    >
      <RePlusPage
        ref="tableRef"
        :title="t('settingSecurity.blockIp')"
        :api="api"
        :auth="auth"
        locale-name="settingSecurity"
        :fetch-search-fields="false"
        :pureTableProps="{
          adaptiveConfig: { offsetBottom: 160 }
        }"
      />
    </el-tab-pane>
  </setting>
</template>
