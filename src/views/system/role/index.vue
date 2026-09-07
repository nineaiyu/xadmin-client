<script lang="ts" setup>
import RolePermissionPreview from "./components/RolePermissionPreview.vue";
import { useRole } from "./utils/hook";

defineOptions({
  name: "SystemRole"
});

const {
  api,
  auth,
  addOrEditOptions,
  listColumnsFormat,
  operationButtonsProps,
  previewRef
} = useRole();
</script>

<template>
  <div>
    <!-- 单根包裹：<Transition> 要求页面组件必须有元素根节点，多根或根级注释都会告警 -->
    <RePlusPage
      :api="api"
      :auth="auth"
      locale-name="systemRole"
      :addOrEditOptions="addOrEditOptions"
      :listColumnsFormat="listColumnsFormat"
      :operationButtonsProps="operationButtonsProps"
      :recycleBin="[{ prop: 'name' }, { prop: 'code' }]"
    />
    <RolePermissionPreview ref="previewRef" />
  </div>
</template>
