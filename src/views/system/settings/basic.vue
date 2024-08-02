<script lang="ts" setup>
import { settingsBasicApi } from "@/api/settings/settings";
import SettingBase from "@/views/system/components/settingBase.vue";
import { reactive } from "vue";
import { hasAuth } from "@/router/utils";

defineOptions({
  name: "SettingBasic"
});
const auth = reactive({
  update: hasAuth("update:SettingBasic"),
  detail: hasAuth("detail:SettingBasic")
});
</script>

<template>
  <el-row :gutter="24" class="main-content">
    <el-col :lg="16" :md="16" :sm="24" :xl="16" :xs="24">
      <setting-base
        :auth="auth"
        :api="settingsBasicApi"
        locale-name="settingBasic"
      />
    </el-col>
  </el-row>
</template>
<style scoped>
.main-content {
  margin: 24px 24px 0 !important;
}
</style>
