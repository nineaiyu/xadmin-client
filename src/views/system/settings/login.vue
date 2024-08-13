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
import RePlusCRUD from "@/components/RePlusCRUD";
import { useI18n } from "vue-i18n";

defineOptions({
  name: "SettingLogin"
});

const settingData = computed<Array<settingItemProps>>(() => [
  {
    auth: {
      update: hasAuth("update:SettingLoginAuth"),
      detail: hasAuth("detail:SettingLoginAuth")
    },
    api: settingsLoginAuthApi,
    localeName: "settingLogin",
    title: "login"
  },
  {
    auth: {
      update: hasAuth("update:SettingLoginLimit"),
      detail: hasAuth("detail:SettingLoginLimit")
    },
    api: settingsLoginLimitApi,
    localeName: "settingLogin",
    title: "limit"
  }
]);
const auth = ref({
  list: hasAuth("list:SettingBlockIp"),
  delete: hasAuth("delete:SettingBlockIp"),
  batchDelete: hasAuth("batchDelete:SettingBlockIp")
});
const api = ref(settingsBlockIpApi);
api.value.fields = undefined;
const { t } = useI18n();
</script>

<template>
  <setting :model-value="settingData">
    <el-tab-pane v-if="auth.list" :label="t('settingLogin.title')" :lazy="true">
      <RePlusCRUD
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
