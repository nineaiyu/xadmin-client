<script lang="ts" setup>
import {
  settingsBlockIpApi,
  settingsLoginAuthApi,
  settingsLoginLimitApi
} from "@/api/system/settings";
import { computed, ref } from "vue";
import { hasAuth } from "@/router/utils";
import Setting from "@/views/system/components/settings/index.vue";
import { settingItemProps } from "@/views/system/components/settings/types";
import { RePlusPage } from "@/components/RePlusPage";
import { useI18n } from "vue-i18n";

defineOptions({
  name: "SettingLogin"
});

const settingData = computed<Array<settingItemProps>>(() => [
  {
    auth: {
      partialUpdate: hasAuth("partialUpdate:SettingLoginAuth"),
      retrieve: hasAuth("retrieve:SettingLoginAuth")
    },
    api: settingsLoginAuthApi,
    localeName: "settingLogin",
    title: "login"
  },
  {
    auth: {
      partialUpdate: hasAuth("partialUpdate:SettingLoginLimit"),
      retrieve: hasAuth("retrieve:SettingLoginLimit")
    },
    api: settingsLoginLimitApi,
    localeName: "settingLogin",
    title: "limit"
  }
]);
const auth = ref({
  list: hasAuth("list:SettingBlockIp"),
  delete: hasAuth("delete:SettingBlockIp"),
  batchDestroy: hasAuth("batchDestroy:SettingBlockIp")
});
const api = ref(settingsBlockIpApi);
api.value.fields = undefined;
const { t } = useI18n();
</script>

<template>
  <setting :model-value="settingData">
    <el-tab-pane v-if="auth.list" :label="t('settingLogin.title')" :lazy="true">
      <RePlusPage
        ref="tableRef"
        :title="t('settingLogin.title')"
        :api="api"
        :auth="auth"
        locale-name="settingLogin"
        :pureTableProps="{
          adaptiveConfig: { offsetBottom: 160 }
        }"
      />
    </el-tab-pane>
  </setting>
</template>
