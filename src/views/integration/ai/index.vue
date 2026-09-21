<script lang="ts" setup>
import { computed, onActivated, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { SUCCESS_CODE } from "@/api/types";
import {
  aiAssistantApi,
  type AiConsoleFeature,
  type AiStatus,
  type AiToolsResult
} from "@/api/system/ai";
import { useAiConsole } from "./hooks/useAiConsole";
import AiFeatureNav, {
  type AiFeatureEntry
} from "./components/AiFeatureNav.vue";
import AiChatPanel from "./components/AiChatPanel.vue";
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

const canAsk = hasAuth("ask:AiAssistant");
const canInterpret = hasAuth("interpret:AiAssistant");
const canRun = hasAuth("run:AiAssistant");
const canExecute = hasAuth("actionExecute:AiAssistant");

const status = ref<AiStatus | null>(null);
const tools = ref<AiToolsResult | null>(null);

const loadStatus = async () => {
  const res = await aiAssistantApi.status();
  if (res.code === SUCCESS_CODE) {
    status.value = res.data as unknown as AiStatus;
  }
  const toolRes = await aiAssistantApi.tools().catch(() => null);
  if (toolRes && toolRes.code === SUCCESS_CODE) {
    tools.value = toolRes.data as unknown as AiToolsResult;
  }
};

const ready = computed(() =>
  Boolean(status.value?.enabled && status.value?.configured)
);

/** 左栏入口按权限点组装（无权限的入口不出现） */
const entries = computed<AiFeatureEntry[]>(() => {
  const list: AiFeatureEntry[] = [];
  if (canAsk) {
    list.push({
      key: "docs",
      title: t("ai.featureDocs"),
      description: t("ai.featureDocsDesc"),
      icon: DocIcon
    });
  }
  if (canInterpret) {
    list.push({
      key: "nl",
      title: t("ai.featureNl"),
      description: t("ai.featureNlDesc"),
      icon: DataIcon
    });
  }
  if (canExecute) {
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

const isNarrow = ref(false);
const drawerVisible = ref(false);

function updateViewport() {
  isNarrow.value = window.innerWidth < 768;
}

function selectFeature(key: AiConsoleFeature) {
  aiConsole.feature.value = key;
  if (isNarrow.value) drawerVisible.value = false;
}

onMounted(() => {
  updateViewport();
  window.addEventListener("resize", updateViewport);
  loadStatus();
});

// keep-alive 页面二次进入不重跑 onMounted，配置保存后需重新拉取状态
onActivated(loadStatus);

onUnmounted(() => {
  window.removeEventListener("resize", updateViewport);
});
</script>

<template>
  <div class="pr-[1%]">
    <!-- pr-[1%]：内容宽度对齐 RePlusPage 的 w-99/100（右侧留 1%），
         根元素自带 layout 注入的 main-content（24px 外边距），不能再设百分比宽度（会溢出） -->
    <template v-if="status && !status.enabled">
      <el-card shadow="never">
        <el-empty :description="t('ai.disabledHint')" />
      </el-card>
    </template>
    <template v-else-if="status && !status.configured">
      <el-card shadow="never">
        <el-empty :description="t('ai.notConfiguredHint')">
          <router-link to="/integration/ai/config">
            <el-button type="primary">{{ t("ai.goConfig") }}</el-button>
          </router-link>
        </el-empty>
      </el-card>
    </template>
    <div
      v-else-if="status"
      class="flex overflow-hidden rounded bg-bg_color"
      :style="{ height: 'calc(100vh - 164px)', minHeight: '420px' }"
      style="border: 1px solid var(--pure-border-color)"
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

      <el-drawer
        v-if="isNarrow"
        v-model="drawerVisible"
        direction="ltr"
        size="80%"
        :with-header="false"
      >
        <AiFeatureNav
          :entries="entries"
          :active="aiConsole.feature.value"
          :footer="navFooter"
          @select="selectFeature"
        />
      </el-drawer>

      <AiChatPanel
        class="grow"
        :title="activeEntry?.title ?? ''"
        :subtitle="subtitle"
        :placeholder="placeholder"
        :empty-text="emptyText"
        :disabled="!ready || !activeEntry"
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
      />
    </div>
  </div>
</template>
