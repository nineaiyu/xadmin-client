<script lang="ts" setup>
import {
  settingsBindEmailApi,
  settingsBindPhoneApi,
  settingsBlockIpApi,
  settingsCaptchaApi,
  settingsLoginAuthApi,
  settingsLoginLimitApi,
  settingsPasswordApi,
  settingsRegisterAuthApi,
  settingsResetPasswordCodeApi,
  settingsVerifyCodeApi
} from "@/api/system/settings";
import { computed, ref } from "vue";
import { hasAuth } from "@/router/utils";
import Setting from "@/views/settings/components/settings/index.vue";
import { settingItemProps } from "@/views/settings/components/settings/types";

import { useI18n } from "vue-i18n";

defineOptions({
  name: "SettingSecurity"
});

const settingData = computed<Array<settingItemProps>>(() => [
  {
    auth: {
      partialUpdate: hasAuth("partialUpdate:SecurityVerifyCode"),
      retrieve: hasAuth("retrieve:SecurityVerifyCode")
    },
    api: settingsVerifyCodeApi,
    localeName: "settingSecurity",
    title: "code"
  },
  {
    auth: {
      partialUpdate: hasAuth("partialUpdate:SecurityCaptchaCode"),
      retrieve: hasAuth("retrieve:SecurityCaptchaCode")
    },
    api: settingsCaptchaApi,
    localeName: "settingSecurity",
    title: "captcha"
  },
  {
    auth: {
      partialUpdate: hasAuth("partialUpdate:SecurityLoginAuth"),
      retrieve: hasAuth("retrieve:SecurityLoginAuth")
    },
    api: settingsLoginAuthApi,
    localeName: "settingSecurity",
    title: "login"
  },
  {
    auth: {
      partialUpdate: hasAuth("partialUpdate:SecurityLoginLimit"),
      retrieve: hasAuth("retrieve:SecurityLoginLimit")
    },
    api: settingsLoginLimitApi,
    localeName: "settingSecurity",
    title: "limit"
  },
  {
    auth: {
      partialUpdate: hasAuth("partialUpdate:SecurityRegisterAuth"),
      retrieve: hasAuth("retrieve:SecurityRegisterAuth")
    },
    api: settingsRegisterAuthApi,
    localeName: "settingSecurity",
    title: "register"
  },
  {
    auth: {
      partialUpdate: hasAuth("partialUpdate:SecurityResetPasswordAuth"),
      retrieve: hasAuth("retrieve:SecurityResetPasswordAuth")
    },
    api: settingsResetPasswordCodeApi,
    localeName: "settingSecurity",
    title: "resetPassword"
  },
  {
    auth: {
      partialUpdate: hasAuth("partialUpdate:SecurityPasswordRule"),
      retrieve: hasAuth("retrieve:SecurityPasswordRule")
    },
    api: settingsPasswordApi,
    localeName: "settingSecurity",
    title: "passwordRule"
  },
  {
    auth: {
      partialUpdate: hasAuth("partialUpdate:SecurityBindEmailAuth"),
      retrieve: hasAuth("retrieve:SecurityBindEmailAuth")
    },
    api: settingsBindEmailApi,
    localeName: "settingSecurity",
    title: "bingEmail"
  },
  {
    auth: {
      partialUpdate: hasAuth("partialUpdate:SecurityBindPhoneAuth"),
      retrieve: hasAuth("retrieve:SecurityBindPhoneAuth")
    },
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
api.value.fields = undefined;
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
        :pureTableProps="{
          adaptiveConfig: { offsetBottom: 160 }
        }"
      />
    </el-tab-pane>
  </setting>
</template>
