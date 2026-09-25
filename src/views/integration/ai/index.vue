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
import { ReNavDrawer } from "@/components/ReNavDrawer";
import ReEmpty from "@/components/ReEmpty";
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
/** 控制台面板高度：按视口实测（面板顶部距离 + 底部留白 + 页脚高度），
 *  替代 calc(100vh - 164px) 魔数——标签栏显隐 / 窗口尺寸变化都自适应 */
const pageRef = ref<HTMLElement | null>(null);
const PANEL_MIN_HEIGHT = 420;
const PANEL_BOTTOM_GAP = 24;
const panelHeight = ref(PANEL_MIN_HEIGHT);

function measurePanelHeight() {
  const el = pageRef.value;
  if (!el) return;
  const top = el.getBoundingClientRect().top;
  // 页脚与面板同处一个滚动容器（紧随其后）：不扣除会把「面板 + 页脚」顶出视口，整页出现滚动
  const footer = document.querySelector(".layout-footer");
  const footerHeight = footer instanceof HTMLElement ? footer.offsetHeight : 0;
  panelHeight.value = Math.max(
    Math.round(window.innerHeight - top - PANEL_BOTTOM_GAP - footerHeight),
    PANEL_MIN_HEIGHT
  );
}

function updateViewport() {
  isNarrow.value = window.innerWidth < 768;
  measurePanelHeight();
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

// keep-alive 页面二次进入不重跑 onMounted：重测面板高度 + 重新拉取状态（配置保存后）
onActivated(() => {
  measurePanelHeight();
  loadStatus();
});

onUnmounted(() => {
  window.removeEventListener("resize", updateViewport);
});
</script>

<template>
  <div ref="pageRef">
    <!-- 控制台面板满宽铺开（不再 pr-[1%]：与聊天室口径一致，四边只保留
         main-content 的 24px 统一边距）；高度按视口实测（measurePanelHeight） -->
    <template v-if="status && !status.enabled">
      <el-card shadow="never">
        <ReEmpty :description="t('ai.disabledHint')" icon="ep/lock" />
      </el-card>
    </template>
    <template v-else-if="status && !status.configured">
      <el-card shadow="never">
        <ReEmpty :description="t('ai.notConfiguredHint')" icon="ep/setting">
          <router-link to="/integration/ai/config">
            <el-button type="primary">{{ t("ai.goConfig") }}</el-button>
          </router-link>
        </ReEmpty>
      </el-card>
    </template>
    <div
      v-else-if="status"
      class="ai-console flex overflow-hidden"
      :style="{
        height: `${panelHeight}px`,
        minHeight: `${PANEL_MIN_HEIGHT}px`
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

<style lang="scss" scoped>
/* 控制台面板：与卡片同一视觉语言（圆角 + 浅阴影 + 主题边框），此前仅 1px 边线 */
.ai-console {
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  box-shadow: var(--el-box-shadow-light);
}
</style>
