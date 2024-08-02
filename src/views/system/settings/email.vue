<script lang="ts" setup>
import { handleOperation } from "@/components/RePlusCRUD";
import {
  settingsEmailServerApi,
  settingsEmailTestApi
} from "@/api/settings/settings";
import { useI18n } from "vue-i18n";
import SettingBase from "@/views/system/components/settingBase.vue";
import { reactive } from "vue";
import { hasAuth } from "@/router/utils";

defineOptions({
  name: "SettingEmail"
});

const auth1 = reactive({
  update: hasAuth("update:SettingEmailServer"),
  detail: hasAuth("detail:SettingEmailServer")
});
const auth2 = reactive({
  update: hasAuth("update:SettingEmailTest"),
  detail: hasAuth("detail:SettingEmailTest")
});
</script>

<template>
  <el-row :gutter="24" class="main-content">
    <el-col :xl="13" :lg="13" :md="24" :sm="24" :xs="24">
      <setting-base
        :api="settingsEmailServerApi"
        locale-name="settingEmail"
        :auth="auth1"
      />
    </el-col>
    <el-col :xl="11" :lg="11" :md="24" :sm="24" :xs="24">
      <setting-base
        :api="settingsEmailTestApi"
        locale-name="settingEmail"
        :auth="auth2"
      />
    </el-col>
  </el-row>
</template>
<style scoped>
.main-content {
  margin: 24px 24px 0 !important;
}
</style>
