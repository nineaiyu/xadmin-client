<script lang="ts" setup>
import { ref } from "vue";
import { useDept } from "./utils/hook";
import DeptPermissionPreview from "./components/DeptPermissionPreview.vue";

defineOptions({
  name: "SystemDept"
});

const tableRef = ref();

const {
  api,
  auth,
  listColumnsFormat,
  addOrEditOptions,
  baseColumnsFormat,
  operationButtonsProps,
  previewRef
} = useDept(tableRef);
</script>

<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    :isTree="true"
    :addOrEditOptions="addOrEditOptions"
    :baseColumnsFormat="baseColumnsFormat"
    :listColumnsFormat="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
    locale-name="systemDept"
  />
  <!-- 部门授权预览：挂载角色 / 数据权限 / 字段权限 / 成员采样（auth.preview 门控按钮） -->
  <DeptPermissionPreview ref="previewRef" />
</template>
