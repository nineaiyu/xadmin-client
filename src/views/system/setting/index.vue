<script lang="ts" setup>
import { useSystemSetting } from "./utils/hook";
import { ref } from "vue";
import { RePlusPage } from "@/components/RePlusPage";

defineOptions({
  name: "SystemSetting"
});

const { api, auth } = useSystemSetting();
</script>

<template>
  <RePlusPage :api="api" :auth="auth" :operation="false" />
</template>
