<script lang="ts" setup>
import { settingsPasswordApi } from "@/api/settings/settings";

import SettingBase from "@/views/system/components/settingBase.vue";
import { reactive } from "vue";
import { hasAuth } from "@/router/utils";

defineOptions({
  name: "SettingPassword"
});
const auth = reactive({
  update: hasAuth("update:SettingPassword"),
  detail: hasAuth("detail:SettingPassword")
});
</script>

<template>
  <el-row :gutter="24" class="main-content">
    <el-col :lg="16" :md="16" :sm="24" :xl="16" :xs="24">
      <setting-base
        :api="settingsPasswordApi"
        locale-name="settingPassword"
        :auth="auth"
      />
    </el-col>
  </el-row>
</template>
<style scoped>
.main-content {
  margin: 24px 24px 0 !important;
}
</style>
