<script lang="ts" setup>
import { ref } from "vue";
import { useDept } from "./utils/hook";

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
  tableBarButtonsProps,
  operationButtonsProps
} = useDept(tableRef);
</script>

<template>
  <div>
    <!-- 单根包裹：<Transition> 要求页面组件必须有元素根节点，多根或根级注释都会告警 -->
    <!-- 部门授权预览：挂载角色 / 数据权限 / 字段权限 / 成员采样（hook 经 addDrawer 打开） -->
    <RePlusPage
      ref="tableRef"
      :api="api"
      :auth="auth"
      :isTree="true"
      :addOrEditOptions="addOrEditOptions"
      :baseColumnsFormat="baseColumnsFormat"
      :listColumnsFormat="listColumnsFormat"
      :tableBarButtonsProps="tableBarButtonsProps"
      :operationButtonsProps="operationButtonsProps"
      locale-name="systemDept"
    />
  </div>
</template>
