<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { getDefaultAuths } from "@/router/utils";
import { approvalInstanceApi } from "@/api/system/approvalFlow";
import InstancePanel from "./components/InstancePanel.vue";

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

/** 任一页签工具条的「发起申请」成功：刷新角标、切到「我的申请」并同步页签数据 */
function handleStarted() {
  loadPendingCount();
  activeTab.value = "mine";
  minePanel.value?.refresh();
  pendingPanel.value?.refresh();
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
  <div class="pr-[1%]">
    <!-- 单根包裹 + 去掉手写 ml/mx：由 layout 注入的 main-content（24px）统一提供边距；
         pr-[1%] 与 RePlusPage 的 w-99/100 等效 -->
    <el-tabs v-model="activeTab">
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
        <InstancePanel
          ref="pendingPanel"
          scope="pending"
          :on-start="handleStarted"
        />
      </el-tab-pane>
      <el-tab-pane
        :label="t('systemApprovalInstance.mineTab')"
        name="mine"
        lazy
      >
        <InstancePanel ref="minePanel" scope="mine" :on-start="handleStarted" />
      </el-tab-pane>
      <el-tab-pane
        :label="t('systemApprovalInstance.doneTab')"
        name="done"
        lazy
      >
        <InstancePanel ref="donePanel" scope="done" :on-start="handleStarted" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>
