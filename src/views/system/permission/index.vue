<script lang="ts" setup>
import { useDataPermission } from "./utils/hook";

defineOptions({
  name: "SystemDataPermission"
});

const {
  api,
  auth,
  addOrEditOptions,
  listColumnsFormat,
  operationButtonsProps,
  lookupAlert
} = useDataPermission();
</script>
<template>
  <div>
    <!-- 依赖的菜单/字段注册表不可用：说明缺少的权限点，新增/编辑已由 hook 禁用 -->
    <el-alert
      v-if="lookupAlert"
      class="mb-2"
      type="warning"
      :closable="false"
      show-icon
      :title="lookupAlert"
    />
    <RePlusPage
      :api="api"
      :auth="auth"
      locale-name="systemPermission"
      :addOrEditOptions="addOrEditOptions"
      :listColumnsFormat="listColumnsFormat"
      :operationButtonsProps="operationButtonsProps"
      recycleBin
    />
  </div>
</template>
