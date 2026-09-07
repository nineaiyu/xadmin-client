<script lang="ts" setup>
import { getCurrentInstance, reactive, ref } from "vue";
import { periodicTaskApi } from "@/api/system/task";
import { getDefaultAuths } from "@/router/utils";

defineOptions({
  name: "SystemTask"
});

const tableRef = ref();
const api = reactive(periodicTaskApi);
const auth = reactive({ ...getDefaultAuths(getCurrentInstance()) });
</script>
<template>
  <RePlusPage ref="tableRef" :api="api" :auth="auth" locale-name="systemTask" />
</template>
