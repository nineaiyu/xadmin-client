<script lang="ts" setup>
import { computed, h, onActivated, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { isSuccess } from "@/api/types";
import {
  aiAssistantApi,
  type AiConsoleFeature,
  type AiStatus,
  type AiToolsResult
} from "@/api/ai/ai";
import { useAiConsole } from "./hooks/useAiConsole";
import { resolveAiConsoleReady } from "./utils/aiConsoleState";
import { useFullHeightPanel } from "@/hooks/useFullHeightPanel";
import { addDrawer } from "@/components/ReDrawer";
import { ReNavDrawer } from "@/components/ReNavDrawer";
import ReResult from "@/components/ReResult";
import AiFeatureNav, {
  type AiFeatureEntry
} from "./components/AiFeatureNav.vue";
import AiChatPanel from "./components/AiChatPanel.vue";
import ToolCatalogDrawer from "./components/ToolCatalogDrawer.vue";
import DocIcon from "~icons/ep/document";
import DataIcon from "~icons/ep/data-analysis";
import ActionIcon from "~icons/ri/terminal-window-line";

/**
 * AI 助手控制台：微信式左右分栏（与聊天室同一套布局口径）。
 *
 * 左栏 = 功能导航（文档问答 / 数据查询 / 指令执行，按权限点组装）；
 * 右栏 = 该入口的持久化消息流 + 输入区（AiChatPanel）。
 * 三个入口各自独立的持久化消息流（服务端 AiChatMessage），切换入口
 * 即切换消息流；窄屏（<768px）左栏折叠为抽屉。
 *
 * 路由/keep-alive 依赖组件名 `AiAssistant`。
 */
defineOptions({
  name: "AiAssistant"
});

const { t } = useI18n();
const aiConsole = useAiConsole();

// 权限点响应式求值：权限表是异步就绪的 store 状态，setup 期一次性快照会失真
const canAsk = computed(() => hasAuth("ask:AiAssistant"));
const canInterpret = computed(() => hasAuth("interpret:AiAssistant"));
const canRun = computed(() => hasAuth("run:AiAssistant"));
const canExecute = computed(() => hasAuth("actionExecute:AiAssistant"));
const canUseConsole = computed(
  () => canAsk.value || canInterpret.value || canExecute.value
);

const status = ref<AiStatus | null>(null);
const tools = ref<AiToolsResult | null>(null);
/** 工具清单加载失败（无缓存值时）：显式提示 + 重试入口，避免入口静默消失 */
const toolsFailed = ref(false);
/** 状态拉取失败（尚无可渲染的状态时）显示显式错误态而非整页空白 */
const statusFailed = ref(false);

/** 工具目录（只读）：命令式抽屉，内容组件只接收工具清单 */
const openToolCatalog = () => {
  addDrawer({
    title: t("ai.toolCatalogTitle"),
    size: "420px",
    hideFooter: true,
    contentRenderer: () =>
      h(ToolCatalogDrawer, { tools: tools.value?.tools ?? [] })
  });
};

const loadStatus = async () => {
  toolsFailed.value = false;
  // 状态与工具清单并行拉取（两者独立渲染，串行只是历史写法的两段 RTT）
  const [res, toolRes] = await Promise.all([
    aiAssistantApi.status().catch(() => null),
    // 工具清单只服务「指令执行」入口；只授 ask 的角色不需要它，
    // 避免其 403 再叠加一条误导性的「工具加载失败」提示
    canExecute.value
      ? aiAssistantApi.tools().catch(() => null)
      : Promise.resolve(null)
  ]);
  if (res && isSuccess(res)) {
    status.value = res.data as AiStatus;
    statusFailed.value = false;
  } else {
    // 重新进入页面（keep-alive）时的失败保留已渲染的控制台，只有无任何状态时才显错误态
    if (!status.value) statusFailed.value = true;
  }
  if (canExecute.value) {
    if (toolRes && isSuccess(toolRes)) {
      tools.value = toolRes.data as AiToolsResult;
      toolsFailed.value = false;
    } else if (!tools.value) {
      // 工具清单失败且无缓存值：显式提示（此前静默，工具数恒显示 0 无从判断）
      toolsFailed.value = true;
      message(t("ai.toolsLoadFailed"), { type: "warning" });
    }
  }
};

const ready = computed(() =>
  // 状态接口不可用（如只授 ask:AiAssistant）时不再把整页判死：
  // 问答入口本身不依赖 status，允许直接使用，页面顶部给出降级说明
  resolveAiConsoleReady(status.value, canUseConsole.value)
);

/** 左栏入口按权限点组装（无权限的入口不出现） */
const entries = computed<AiFeatureEntry[]>(() => {
  const list: AiFeatureEntry[] = [];
  if (canAsk.value) {
    list.push({
      key: "docs",
      title: t("ai.featureDocs"),
      description: t("ai.featureDocsDesc"),
      icon: DocIcon
    });
  }
  if (canInterpret.value) {
    list.push({
      key: "nl",
      title: t("ai.featureNl"),
      description: t("ai.featureNlDesc"),
      icon: DataIcon
    });
  }
  if (canExecute.value) {
    list.push({
      key: "action",
      title: t("ai.featureAction"),
      description: t("ai.featureActionDesc"),
      icon: ActionIcon
    });
  }
  return list;
});

const activeEntry = computed(
  () =>
    entries.value.find(item => item.key === aiConsole.feature.value) ??
    entries.value[0] ??
    null
);

// 权限变化时当前入口可能不可见：回落第一个可用入口
watch(entries, list => {
  if (list.length && !list.some(item => item.key === aiConsole.feature.value)) {
    aiConsole.feature.value = list[0].key;
  }
});

const placeholder = computed(() => {
  if (aiConsole.feature.value === "nl") return t("ai.nlPlaceholder");
  if (aiConsole.feature.value === "action") return t("ai.actionPlaceholder");
  return t("ai.askPlaceholder");
});

const emptyText = computed(() =>
  activeEntry.value
    ? t("ai.emptyMessages", { name: activeEntry.value.title })
    : t("ai.emptyMessages", { name: t("ai.featureDocs") })
);

const subtitle = computed(() => {
  if (!activeEntry.value) return "";
  if (aiConsole.feature.value === "docs" && status.value) {
    return `${t("ai.knowledgeChunks")}: ${status.value.chunks}`;
  }
  if (aiConsole.feature.value === "action" && tools.value) {
    return t("ai.actionToolCount", { count: tools.value.tools.length });
  }
  return activeEntry.value.description;
});

const navFooter = computed(() => (ready.value ? t("ai.persistHint") : ""));

const drawerVisible = ref(false);
/** 控制台面板高度与窄屏折叠：与聊天室同一布局口径（视口实测），
 *  替代 calc(100vh - 164px) 魔数 */
const { pageRef, panelHeight, panelMinHeight, isNarrow } = useFullHeightPanel();

function selectFeature(key: AiConsoleFeature) {
  aiConsole.feature.value = key;
  if (isNarrow.value) drawerVisible.value = false;
}

const route = useRoute();
const router = useRouter();
/** 命令面板「问 AI」预填载荷（经 ?q= 携带）：seq 保证同词两次进入也触发预填 */
const askPayload = ref<{ seq: number; text: string } | null>(null);
let askSeq = 0;

/** 消费 ?q=：切到问答入口并预填输入框（消费后从 URL 移除，避免刷新重复预填） */
function consumeAskQuery() {
  const question =
    typeof route.query.q === "string" ? route.query.q.trim() : "";
  if (!question || !canAsk.value) return;
  aiConsole.feature.value = "docs";
  askPayload.value = { seq: ++askSeq, text: question };
  router.replace({ query: { ...route.query, q: undefined } });
}

let activatedOnce = false;
onMounted(() => {
  loadStatus();
  consumeAskQuery();
  activatedOnce = true;
});

// keep-alive 二次进入重新拉取状态；首次挂载已由 onMounted 拉取，避免双请求
onActivated(() => {
  if (!activatedOnce) {
    activatedOnce = true;
    return;
  }
  loadStatus();
  consumeAskQuery();
});
</script>

<template>
  <div ref="pageRef">
    <!-- 控制台面板满宽铺开（不再 pr-[1%]：与聊天室口径一致，四边只保留
         main-content 的 24px 统一边距）；高度按视口实测（useFullHeightPanel） -->
    <template v-if="statusFailed && !canUseConsole">
      <el-card shadow="never">
        <ReResult status="error" :title="t('ai.statusLoadFailed')">
          <template #extra>
            <el-button type="primary" @click="loadStatus">
              {{ t("ai.retry") }}
            </el-button>
          </template>
        </ReResult>
      </el-card>
    </template>
    <template v-else-if="status && !status.enabled">
      <el-card shadow="never">
        <ReResult status="warning" :title="t('ai.disabledHint')" />
      </el-card>
    </template>
    <template v-else-if="status && !status.configured">
      <el-card shadow="never">
        <ReResult status="info" :title="t('ai.notConfiguredHint')">
          <template #extra>
            <router-link to="/integration/ai/config">
              <el-button type="primary">{{ t("ai.goConfig") }}</el-button>
            </router-link>
          </template>
        </ReResult>
      </el-card>
    </template>
    <template v-else-if="status || canUseConsole">
      <el-alert
        v-if="statusFailed"
        class="mb-2"
        type="warning"
        :closable="false"
        show-icon
        :title="t('ai.statusDegraded')"
      />
      <el-alert
        v-if="toolsFailed && canExecute"
        class="mb-2"
        type="warning"
        :closable="false"
        show-icon
        :title="t('ai.toolsLoadFailed')"
      >
        <el-button link type="primary" size="small" @click="loadStatus">
          {{ t("ai.retry") }}
        </el-button>
      </el-alert>
      <div
        v-if="tools?.tools.length"
        class="mb-2 flex justify-end"
        data-testid="ai-tool-catalog-trigger"
      >
        <el-button size="small" @click="openToolCatalog">
          {{ t("ai.toolCatalog", { count: tools.tools.length }) }}
        </el-button>
      </div>
      <div
        class="ai-console flex overflow-hidden"
        :style="{
          height: `${panelHeight}px`,
          minHeight: `${panelMinHeight}px`
        }"
        data-testid="ai-console"
      >
        <AiFeatureNav
          v-if="!isNarrow"
          class="w-70 shrink-0"
          :entries="entries"
          :active="aiConsole.feature.value"
          :footer="navFooter"
          @select="selectFeature"
        />

        <ReNavDrawer v-model="drawerVisible" :narrow="isNarrow">
          <AiFeatureNav
            :entries="entries"
            :active="aiConsole.feature.value"
            :footer="navFooter"
            @select="selectFeature"
          />
        </ReNavDrawer>

        <AiChatPanel
          class="grow"
          :title="activeEntry?.title ?? ''"
          :subtitle="subtitle"
          :placeholder="placeholder"
          :empty-text="emptyText"
          :disabled="!ready || !activeEntry"
          :initial-draft="askPayload"
          :loading-history="aiConsole.loadingHistory.value"
          :has-more="aiConsole.hasMore.value"
          :loading-more="aiConsole.loadingMore.value"
          :groups="aiConsole.messageGroups.value"
          :active-streaming="aiConsole.activeStreaming.value"
          :streaming="Boolean(aiConsole.activeStreaming.value)"
          :pending-count="aiConsole.pendingCount.value"
          :nl-running="aiConsole.nlRunning.value"
          :nl-runnable="canRun"
          :action-executor="aiConsole.executeAction"
          :is-narrow="isNarrow"
          @send="aiConsole.send"
          @stop="aiConsole.abortStream"
          @load-more="aiConsole.loadMore"
          @scroll="aiConsole.onScroll"
          @scroll-to-bottom="aiConsole.scrollToBottom"
          @scroller="el => (aiConsole.scroller.value = el)"
          @toggle-nav="drawerVisible = true"
          @run-nl="dsl => aiConsole.runNl(dsl)"
          @retry="text => aiConsole.send(text)"
        />
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
/* 控制台面板：与卡片同一视觉语言（圆角 + 浅阴影 + 主题边框），此前仅 1px 边线 */
.ai-console {
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--radius-xl);
  box-shadow: var(--el-box-shadow-light);
}
</style>
