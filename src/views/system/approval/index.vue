<script lang="ts" setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import PendingPanel from "./components/PendingPanel.vue";
import MinePanel from "./components/MinePanel.vue";
import ApprovalStats from "./components/ApprovalStats.vue";
import { useApprovalBadge } from "@/utils/approvalBadge";

defineOptions({
  name: "SystemApprovalRequest" // 必须定义，用于菜单自动匹配组件
});
const { t } = useI18n();
const activeTab = ref("pending");

/** 页签角标 = 待我审批数（与顶栏铃铛同一数据源：60s 轮询 + 服务端 10s 短缓存） */
const { pendingCount } = useApprovalBadge();
</script>
<template>
  <ApprovalStats />
  <el-tabs v-model="activeTab" class="mx-3 mt-2">
    <el-tab-pane name="pending">
      <template #label>
        <el-badge
          :value="pendingCount"
          :max="99"
          :hidden="pendingCount === 0"
          class="mr-1"
        >
          {{ t("approval.pendingTab") }}
        </el-badge>
      </template>
      <PendingPanel />
    </el-tab-pane>
    <el-tab-pane :label="t('approval.mineTab')" name="mine" lazy>
      <MinePanel />
    </el-tab-pane>
  </el-tabs>
</template>
