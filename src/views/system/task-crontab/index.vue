<script lang="ts" setup>
import { getCurrentInstance, reactive, ref } from "vue";
import { crontabScheduleApi } from "@/api/system/task";
import { getDefaultAuths } from "@/router/utils";
import { useTaskCrontab } from "./utils/hook";

defineOptions({
  name: "SystemTaskCrontab"
});

const tableRef = ref();
const api = reactive(crontabScheduleApi);
const auth = reactive({ ...getDefaultAuths(getCurrentInstance()) });
const { listColumnsFormat } = useTaskCrontab();
</script>
<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="systemTaskCrontab"
    :listColumnsFormat="listColumnsFormat"
  />
</template>
