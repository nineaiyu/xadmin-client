<script lang="ts" setup>
// 系统设置 → 登录安全：登录方式/防护、登录限制、MFA 与安全拦截 IP。
// 注册、找回密码、密码规则、账号绑定与验证码策略已归入「账号安全」页。
import {
  settingsBlockIpApi,
  settingsLoginAuthApi,
  settingsLoginLimitApi,
  settingsMfaApi
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

/** 面板键取各配置域标题（login/limit/mfa/...），与 i18n 片段一一对应 */
const settingData = computed<Array<settingsPane>>(() => [
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
