<script lang="ts" setup>
import { useTags } from "./utils/hook";

defineOptions({
  name: "SystemTag" // 必须定义，用于菜单自动匹配组件
});

const {
  api,
  auth,
  addOrEditOptions,
  listColumnsFormat,
  operationButtonsProps
} = useTags();
</script>

<template>
  <div>
    <el-alert
      class="mb-2"
      type="info"
      :closable="false"
      show-icon
      :title="$t('tag.usageHint')"
    />
    <RePlusPage
      :api="api"
      :auth="auth"
      locale-name="tag"
      :selection="false"
      :addOrEditOptions="addOrEditOptions"
      :listColumnsFormat="listColumnsFormat"
      :operationButtonsProps="operationButtonsProps"
    />
  </div>
</template>
