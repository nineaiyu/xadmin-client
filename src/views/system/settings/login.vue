<script lang="ts" setup>
import {
  settingsLoginAuthApi,
  settingsLoginLimitApi
} from "@/api/settings/settings";
import SettingBase from "@/views/system/components/settingBase.vue";
import { reactive } from "vue";
import { hasAuth } from "@/router/utils";

defineOptions({
  name: "SettingLogin"
});
const auth1 = reactive({
  update: hasAuth("update:SettingLoginAuth"),
  detail: hasAuth("detail:SettingLoginAuth")
});
const auth2 = reactive({
  update: hasAuth("update:SettingLoginLimit"),
  detail: hasAuth("detail:SettingLoginLimit")
});
</script>

<template>
  <el-row :gutter="24" class="main-content">
    <el-col :lg="8" :md="24" :sm="24" :xl="8" :xs="24">
      <setting-base
        :api="settingsLoginAuthApi"
        locale-name="settingLogin"
        :auth="auth1"
      />
    </el-col>
    <el-col :lg="16" :md="24" :sm="24" :xl="16" :xs="24">
      <setting-base
        :auth="auth2"
        :api="settingsLoginLimitApi"
        locale-name="settingLogin"
        title="limit"
        :form-props="{
          labelWidth: '300px'
        }"
      />
    </el-col>
  </el-row>
</template>

<style scoped>
.main-content {
  margin: 24px 24px 0 !important;
}
</style>
