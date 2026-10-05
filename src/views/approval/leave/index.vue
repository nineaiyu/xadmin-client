<script lang="ts" setup>
import { ref } from "vue";
import { leaveApi } from "@/api/approval/leave";
import { useLeave } from "./utils/hook";
import ApprovalStats from "../components/ApprovalStats.vue";

defineOptions({
  name: "SystemLeave" // 必须与后端菜单 name 一致（权限码后缀 + 路由组件匹配）
});

const tableRef = ref();
/** 统计卡实例：提交 / 撤回后随列表一起刷新 */
const statsRef = ref<{ refresh: () => void } | null>(null);

const {
  api,
  auth,
  operationButtonsProps,
  listColumnsFormat,
  addOrEditOptions
} = useLeave(tableRef, statsRef);
</script>

<template>
  <div>
    <!-- 单根包裹：layout 注入的 main-content（24px 外边距）只有单根组件才会继承 -->
    <!-- 近 30 天我的请假统计（复用审批统计卡组件；指标口径改为请假侧文案，
         后端 stats 接口此前只有定义无消费，此处接入） -->
    <ApprovalStats
      ref="statsRef"
      :loader="leaveApi.stats"
      auth-code="stats:SystemLeave"
      :show-avg-duration="false"
      :labelKeys="{
        submitted: 'leaveApply.statsSubmitted',
        approved: 'leaveApply.statsApproved',
        rejected: 'leaveApply.statsRejected',
        pending: 'leaveApply.statsPending'
      }"
    />
    <RePlusPage
      ref="tableRef"
      :api="api"
      :auth="auth"
      :addOrEditOptions="addOrEditOptions"
      :listColumnsFormat="listColumnsFormat"
      :operationButtonsProps="operationButtonsProps"
      locale-name="leaveApply"
    />
  </div>
</template>
