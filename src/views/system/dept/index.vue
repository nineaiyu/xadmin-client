<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { useDept } from "./utils/hook";

defineOptions({
  name: "SystemDept"
});

const { t } = useI18n();

const {
  api,
  auth,
  tableRef,
  listColumnsFormat,
  addOrEditOptions,
  baseColumnsFormat,
  tableBarButtonsProps,
  operationButtonsProps
} = useDept();
</script>

<template>
  <div>
    <!-- 单根包裹：<Transition> 要求页面组件必须有元素根节点，多根或根级注释都会告警 -->
    <!-- 部门授权预览：挂载角色 / 数据权限 / 字段权限 / 成员采样（hook 经 addDrawer 打开） -->
    <!-- 部门为硬删语义（非软删），页面显式说明不可恢复与前置条件 -->
    <el-alert
      class="mb-2"
      type="warning"
      :closable="false"
      show-icon
      :title="t('systemDept.hardDeleteHint')"
    />
    <RePlusPage
      ref="tableRef"
      :api="api"
      :auth="auth"
      :selection="Boolean(auth.batchDestroy)"
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
