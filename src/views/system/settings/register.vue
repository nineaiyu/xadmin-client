<script lang="ts" setup>
import { settingsRegisterAuthApi } from "@/api/settings/settings";
import SettingBase from "@/views/system/components/settingBase.vue";
import { reactive } from "vue";
import { hasAuth } from "@/router/utils";

defineOptions({
  name: "SettingRegister"
});
const auth = reactive({
  update: hasAuth("update:SettingRegisterAuth"),
  detail: hasAuth("detail:SettingRegisterAuth")
});
</script>

<template>
  <el-row :gutter="24" class="main-content">
    <el-col :lg="8" :md="8" :sm="24" :xl="8" :xs="24">
      <setting-base
        :api="settingsRegisterAuthApi"
        locale-name="settingRegister"
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
