<script lang="ts" setup>
import { useSystemSetting } from "./utils/hook";

defineOptions({
  name: "SystemSetting"
});

const { api, auth } = useSystemSetting();
</script>

<template>
  <RePlusPage :api="api" :auth="auth" :operation="false" />
</template>
