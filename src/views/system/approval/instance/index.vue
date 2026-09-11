<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { getDefaultAuths } from "@/router/utils";
import { approvalInstanceApi } from "@/api/system/approvalFlow";
import InstancePanel from "./components/InstancePanel.vue";
import { openStartInstanceDialog } from "./utils/hook";

defineOptions({
  name: "SystemApprovalInstance" // 必须定义，用于菜单自动匹配组件
});

const AUTH = getDefaultAuths("SystemApprovalInstance", ["pendingCount"]);
const { t } = useI18n();
const activeTab = ref("pending");

const pendingPanel = ref();
const minePanel = ref();
const donePanel = ref();

/** 页签角标 = 待我审批数（60s 轮询；服务端 10s 短缓存，失败静默） */
const pendingCount = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;
function loadPendingCount() {
  if (!AUTH.pendingCount) return;
  approvalInstanceApi
    .pendingCount()
    .then(res => {
      if (res.code === 1000 && res.data) {
        pendingCount.value = Number(res.data.pending ?? 0);
      }
    })
    .catch(() => undefined);
}

/** 发起申请：弹窗内选择流程 + 动态表单，成功后切到「我的申请」并刷新 */
function openStart() {
  openStartInstanceDialog(t("systemApprovalInstance.startTitle"), () => {
    activeTab.value = "mine";
    minePanel.value?.refresh();
    pendingPanel.value?.refresh();
    loadPendingCount();
  });
}

onMounted(() => {
  loadPendingCount();
  timer = setInterval(loadPendingCount, 60_000);
});
onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>
<template>
  <div class="mb-2 ml-3 mt-3">
    <el-button v-if="AUTH.create" type="primary" @click="openStart">
      {{ t("systemApprovalInstance.start") }}
    </el-button>
  </div>
  <el-tabs v-model="activeTab" class="mx-3 mt-2">
    <el-tab-pane name="pending">
      <template #label>
        <el-badge
          :value="pendingCount"
          :max="99"
          :hidden="pendingCount === 0"
          class="mr-1"
        >
          {{ t("systemApprovalInstance.pendingTab") }}
        </el-badge>
      </template>
      <InstancePanel ref="pendingPanel" scope="pending" />
    </el-tab-pane>
    <el-tab-pane :label="t('systemApprovalInstance.mineTab')" name="mine" lazy>
      <InstancePanel ref="minePanel" scope="mine" />
    </el-tab-pane>
    <el-tab-pane :label="t('systemApprovalInstance.doneTab')" name="done" lazy>
      <InstancePanel ref="donePanel" scope="done" />
    </el-tab-pane>
  </el-tabs>
</template>
