<script lang="ts" setup>
import { ref } from "vue";
import { useLoginPolicy } from "./utils/hook";

defineOptions({
  name: "SystemLoginPolicy"
});

const tableRef = ref();

const { api, auth, tableBarButtonsProps, operationButtonsProps } =
  useLoginPolicy(tableRef);
</script>

<template>
  <div v-if="auth.list">
    <!-- 登录访问策略（F-7）：时段 / 网段 × 对象，按优先级首个命中生效；预演可见逐条匹配结果 -->
    <RePlusPage
      ref="tableRef"
      :api="api"
      :auth="auth"
      locale-name="systemLoginPolicy"
      :tableBarButtonsProps="tableBarButtonsProps"
      :operationButtonsProps="operationButtonsProps"
    />
  </div>
</template>
