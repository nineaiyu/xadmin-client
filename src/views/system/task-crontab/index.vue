<script lang="ts" setup>
import { getCurrentInstance, reactive, ref } from "vue";
import { crontabScheduleApi } from "@/api/system/task";
import { getDefaultAuths } from "@/router/utils";

defineOptions({
  name: "SystemTaskCrontab"
});

const tableRef = ref();
const api = reactive(crontabScheduleApi);
const auth = reactive({ ...getDefaultAuths(getCurrentInstance()) });
</script>
<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="systemTaskCrontab"
  />
</template>
