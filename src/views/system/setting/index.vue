<script lang="ts" setup>
import { useSystemSetting } from "./utils/hook";

defineOptions({
  name: "SystemSetting"
});

const { api, auth } = useSystemSetting();
</script>

<template>
  <!-- locale-name 与 locales 的 setting 命名空间对应：列头不再回退后端 verbose_name -->
  <RePlusPage
    :api="api"
    :auth="auth"
    locale-name="setting"
    :operation="false"
  />
</template>
