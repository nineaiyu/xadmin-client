<script lang="ts" setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import PendingPanel from "./components/PendingPanel.vue";
import MinePanel from "./components/MinePanel.vue";

defineOptions({
  name: "SystemApprovalRequest" // 必须定义，用于菜单自动匹配组件
});
const { t } = useI18n();
const activeTab = ref("pending");
</script>
<template>
  <el-tabs v-model="activeTab" class="mx-3">
    <el-tab-pane :label="t('approval.pendingTab')" name="pending">
      <PendingPanel />
    </el-tab-pane>
    <el-tab-pane :label="t('approval.mineTab')" name="mine" lazy>
      <MinePanel />
    </el-tab-pane>
  </el-tabs>
</template>
