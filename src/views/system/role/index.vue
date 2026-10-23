<script lang="ts" setup>
import { useRole } from "./utils/hook";

defineOptions({
  name: "SystemRole"
});

const {
  api,
  auth,
  tableRef,
  addOrEditOptions,
  listColumnsFormat,
  tableBarButtonsProps,
  operationButtonsProps,
  menuAlert
} = useRole();
</script>

<template>
  <div>
    <!-- 单根包裹：<Transition> 要求页面组件必须有元素根节点，多根或根级注释都会告警 -->
    <!-- 权限预览抽屉由 hook 经 addDrawer 打开（弹层体系统一收口） -->
    <!-- 授权树不可用：显式说明原因（新增/编辑已由 hook 按同一条件禁用） -->
    <el-alert
      v-if="menuAlert"
      class="mb-2"
      type="warning"
      :closable="false"
      show-icon
      :title="menuAlert"
    />
    <RePlusPage
      ref="tableRef"
      :api="api"
      :auth="auth"
      locale-name="systemRole"
      saved-views
      :addOrEditOptions="addOrEditOptions"
      :listColumnsFormat="listColumnsFormat"
      :tableBarButtonsProps="tableBarButtonsProps"
      :operationButtonsProps="operationButtonsProps"
      recycleBin
    />
  </div>
</template>
