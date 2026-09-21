<script lang="ts" setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { approvalInstanceApi } from "@/api/system/approvalFlow";
import { hasAuth } from "@/router/utils";
import { refreshApprovalBadge, useApprovalBadge } from "@/utils/approvalBadge";
import InstancePanel from "./components/InstancePanel.vue";
import ApprovalStats from "../components/ApprovalStats.vue";

defineOptions({
  name: "SystemApprovalInstance" // 必须定义，用于菜单自动匹配组件
});

const { t } = useI18n();
const activeTab = ref("pending");

const pendingPanel = ref();
const minePanel = ref();
const donePanel = ref();
const ongoingPanel = ref();
const statsRef = ref<{ refresh: () => void } | null>(null);

/** 管理视角（全部在途）：按 ongoing 权限点显示（后端 scope=ongoing 同口径校验） */
const ongoingVisible = hasAuth("ongoing:SystemApprovalInstance");

/**
 * 页签角标 = 待我审批数（共享单例：顶栏铃铛与本页签共用同一计数，
 * 60s 轮询 + 服务端 10s 短缓存，无权限码时不发请求、失败静默）。
 */
const { flowPendingCount: pendingCount } = useApprovalBadge();

/** 任一页签工具条的「发起申请」成功：刷新角标、切到「我的申请」并同步页签数据 */
function handleStarted() {
  refreshApprovalBadge();
  statsRef.value?.refresh();
  activeTab.value = "mine";
  minePanel.value?.refresh();
  pendingPanel.value?.refresh();
}
</script>
<template>
  <div class="pr-[1%]">
    <!-- 单根包裹 + 去掉手写 ml/mx：由 layout 注入的 main-content（24px）统一提供边距；
         pr-[1%] 与 RePlusPage 的 w-99/100 等效 -->
    <!-- 近 30 天统计（复用轻量审批的统计卡组件，实例口径无「平均审批时长」指标） -->
    <ApprovalStats
      ref="statsRef"
      :loader="approvalInstanceApi.stats"
      auth-code="stats:SystemApprovalInstance"
      :show-avg-duration="false"
    />
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
      <!-- 管理视角：全部审批中的申请（巡看 / 催办），按 ongoing 权限点显示 -->
      <el-tab-pane
        v-if="ongoingVisible"
        :label="t('systemApprovalInstance.ongoingTab')"
        name="ongoing"
        lazy
      >
        <InstancePanel
          ref="ongoingPanel"
          scope="ongoing"
          :on-start="handleStarted"
        />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>
