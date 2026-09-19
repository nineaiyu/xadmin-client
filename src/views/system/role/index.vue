<script lang="ts" setup>
import { useRole } from "./utils/hook";

defineOptions({
  name: "SystemRole"
});

const { api, auth, addOrEditOptions, operationButtonsProps } = useRole();
</script>

<template>
  <div>
    <!-- 单根包裹：<Transition> 要求页面组件必须有元素根节点，多根或根级注释都会告警 -->
    <!-- 权限预览抽屉由 hook 经 addDrawer 打开（弹层体系统一收口） -->
    <RePlusPage
      :api="api"
      :auth="auth"
      locale-name="systemRole"
      :addOrEditOptions="addOrEditOptions"
      :operationButtonsProps="operationButtonsProps"
      recycleBin
    />
  </div>
</template>
