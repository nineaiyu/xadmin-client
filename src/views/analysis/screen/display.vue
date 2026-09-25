<script lang="ts" setup>
import { SUCCESS_CODE } from "@/api/types";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { screenApi, type ScreenItem } from "@/api/system/analysis";
import {
  dashboardApi,
  listRows,
  type DashboardCard,
  type DashboardItem
} from "@/api/system/datasets";
import {
  isOutboundMessage,
  MessageAction,
  type ScreenCommandPayload
} from "@/utils/websocket/protocol";
import { WS } from "@/utils/websocket";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
// 仅类型引用（不进包）：导出实现按需动态加载（保持首屏体积）
import type { ExportedImage } from "@/utils/imageExport";
import { resolveScreenFrame } from "./utils/control";
import ChartCard from "@/views/dashboard/components/ChartCard.vue";
import ReEmpty from "@/components/ReEmpty";
import PauseIcon from "~icons/ep/video-pause";
import PlayIcon from "~icons/ep/video-play";
import FullscreenIcon from "~icons/ep/full-screen";
import DownloadIcon from "~icons/ep/download";

defineOptions({
  name: "DataScreenDisplay"
});

/**
 * 大屏投屏：全屏轮播 Screen 内的仪表盘，按 refresh 秒自动重拉数据。
 * 权限复用仪表盘可见性：对当前浏览者不可见的仪表盘自动跳过。
 * 图表渲染复用一期的 ChartCard（defineExpose loadData 供定时刷新）。
 *
 * 远程控制：连接 ws/screen/<pk> 接收管理端指令（切换/翻页/刷新/恢复轮播）；
 * manual 态停本地轮播并停在远程指定页，auto 态恢复轮播。控制帧按
 * 「服务端 dashboards 下标 → 本地可见列表」映射，跳过不可见仪表盘不会错位。
 */

const route = useRoute();
const { t } = useI18n();

const screen = ref<ScreenItem | null>(null);
const dashboards = ref<DashboardItem[]>([]);
const pageIndex = ref(0);
const paused = ref(false);
const clock = ref("");
/** 远程控制态：manual = 管理端接管（停轮播）；连接时以服务端回放为准 */
const controlMode = ref<"auto" | "manual">("auto");

const currentDashboard = computed(
  () => dashboards.value[pageIndex.value] ?? null
);
const currentCards = computed<DashboardCard[]>(
  () => currentDashboard.value?.layout ?? []
);

/** 卡片组件句柄：模板 ref 收集 ChartCard（loadData 刷新 + renderImage 图片导出） */
type CardHandle = {
  loadData?: () => void;
  renderImage?: () => Promise<ExportedImage | null>;
};
const cardRefs = ref<Record<string, CardHandle | undefined>>({});
const setCardRef = (cardId: string) => (el: unknown) => {
  const handle = el as CardHandle | null;
  if (handle) cardRefs.value[cardId] = handle;
};

const refreshVisible = () => {
  for (const card of currentCards.value) {
    cardRefs.value[card.id]?.loadData?.();
  }
};

/** 导出当前屏：逐卡渲染图片并按 ZIP 打包（一次下载，规避浏览器对连续下载的拦截） */
const exporting = ref(false);
const exportScreen = async () => {
  if (exporting.value || currentCards.value.length === 0) return;
  exporting.value = true;
  try {
    const { buildZipStore, downloadBlob, safeFileName } =
      await import("@/utils/imageExport");
    const files: { name: string; data: Uint8Array }[] = [];
    let skipped = 0;
    for (const card of currentCards.value) {
      const image = await cardRefs.value[card.id]?.renderImage?.();
      if (!image) {
        skipped += 1;
        continue;
      }
      const base = safeFileName(
        String(card.title ?? card.id),
        `card-${files.length + 1}`
      );
      files.push({
        name: `${base}.${image.extension}`,
        data: new Uint8Array(await image.blob.arrayBuffer())
      });
    }
    if (files.length === 0) {
      message(t("dataScreen.exportNoChart"), { type: "warning" });
      return;
    }
    downloadBlob(buildZipStore(files), `screen-${Date.now()}.zip`);
    if (skipped > 0) {
      message(t("dataScreen.exportSkipped", { count: skipped }), {
        type: "warning"
      });
    }
  } finally {
    exporting.value = false;
  }
};

let pageTimer: number | undefined;
let refreshTimer: number | undefined;
let clockTimer: number | undefined;
let ws: WS | null = null;
/** 最近一次数据刷新代数：重连回放/重复帧不触发多余重拉 */
let lastRefreshRev = 0;

const stopTimers = () => {
  [pageTimer, refreshTimer, clockTimer].forEach(
    timer => timer && window.clearInterval(timer)
  );
  pageTimer = refreshTimer = clockTimer = undefined;
};

const startTimers = () => {
  stopTimers();
  const interval = Math.max((screen.value?.interval ?? 15) * 1000, 5000);
  const refresh = Math.max((screen.value?.refresh ?? 60) * 1000, 10000);
  pageTimer = window.setInterval(() => {
    if (
      paused.value ||
      controlMode.value === "manual" ||
      dashboards.value.length === 0
    )
      return;
    pageIndex.value = (pageIndex.value + 1) % dashboards.value.length;
  }, interval);
  refreshTimer = window.setInterval(refreshVisible, refresh);
  clockTimer = window.setInterval(() => {
    clock.value = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  }, 1000);
};

/** 服务端下标 → 本地可见列表下标（服务端按 Screen.dashboards 原序计页） */
const applyServerIndex = (serverIndex: number) => {
  const pk = (screen.value?.dashboards ?? [])[serverIndex];
  if (!pk) return;
  const localIndex = dashboards.value.findIndex(item => item.pk === pk);
  if (localIndex >= 0) pageIndex.value = localIndex;
};

/** 应用控制帧：模式/页码对齐 + refresh 帧仅在代数递增时重拉数据（纯函数内核见 utils/control.ts） */
const applyScreenFrame = (frame: ScreenCommandPayload) => {
  const effect = resolveScreenFrame(
    { mode: controlMode.value, refreshRev: lastRefreshRev },
    frame
  );
  controlMode.value = effect.mode;
  lastRefreshRev = effect.refreshRev;
  if (effect.serverIndex !== null) applyServerIndex(effect.serverIndex);
  if (effect.refresh) refreshVisible();
};

/** 展示端通道：连接即回放控制态，此后被动接收控制帧（断线由 WS 自带退避重连） */
const startWs = (pk: string) => {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WS(`${protocol}//${location.host}/ws/screen/${pk}`, {
    autoReconnect: true,
    heartbeat: true
  });
  ws.onMessage((res: unknown) => {
    if (
      !isOutboundMessage<ScreenCommandPayload>(
        res,
        MessageAction.SCREEN_COMMAND
      )
    )
      return;
    if (res.code !== SUCCESS_CODE || !res.data) return;
    applyScreenFrame(res.data);
  });
};

const toggleFullscreen = () => {
  if (document.fullscreenElement) {
    void document.exitFullscreen();
  } else {
    void document.documentElement.requestFullscreen?.();
  }
};

onMounted(async () => {
  const pk = String(route.query.pk ?? "");
  if (!pk) return;
  const res = await screenApi.retrieve(pk);
  if (res.code !== SUCCESS_CODE) return;
  screen.value = res.data as ScreenItem;
  // 仅保留浏览者可见的仪表盘（personal 对他人不在可见列表内）
  const all = listRows<DashboardItem>(
    (await fetchAllRows(dashboardApi.list)) as never
  );
  dashboards.value = (screen.value?.dashboards ?? [])
    .map((id: string) => all.find((item: DashboardItem) => item.pk === id))
    .filter((item): item is DashboardItem => Boolean(item));
  startTimers();
  startWs(pk);
});

onBeforeUnmount(() => {
  stopTimers();
  ws?.close();
  ws = null;
});
</script>

<template>
  <div class="screen-root fixed inset-0 overflow-auto text-white">
    <!-- 氛围底：径向光晕 + 纵向渐变（恒深色投屏，不随站点主题） -->
    <div class="screen-ambient" aria-hidden="true" />

    <header class="screen-header">
      <div class="flex items-baseline gap-3">
        <!-- 标题内外层保留「大屏名 · 看板名」连读文本（用例按该文本定位），
             视觉层次由内层 span 的字号/透明度表达 -->
        <span class="screen-title">
          {{ screen?.name }}
          <span class="screen-subtitle">· {{ currentDashboard?.name }}</span>
        </span>
      </div>
      <span class="screen-page"
        >{{ pageIndex + 1 }} / {{ dashboards.length }}</span
      >
      <!-- 远程接管指示：manual 态停本地轮播，回到 auto 后指示消失 -->
      <el-tag
        v-if="controlMode === 'manual'"
        size="small"
        type="warning"
        effect="dark"
      >
        {{ t("dataScreen.remoteControlling") }}
      </el-tag>
      <div class="flex-1" />
      <span class="screen-clock">{{ clock }}</span>
      <el-button
        size="small"
        :icon="DownloadIcon"
        :loading="exporting"
        data-testid="screen-export"
        @click="exportScreen"
      >
        {{ t("dataScreen.exportScreen") }}
      </el-button>
      <el-button
        size="small"
        :icon="paused ? PlayIcon : PauseIcon"
        :aria-label="paused ? t('dataScreen.resume') : t('dataScreen.pause')"
        :title="paused ? t('dataScreen.resume') : t('dataScreen.pause')"
        data-testid="screen-pause"
        @click="paused = !paused"
      />
      <el-button
        size="small"
        :icon="FullscreenIcon"
        :aria-label="t('dataScreen.fullscreen')"
        :title="t('dataScreen.fullscreen')"
        data-testid="screen-fullscreen"
        @click="toggleFullscreen"
      />
    </header>

    <ReEmpty
      v-if="dashboards.length === 0"
      :description="t('dataScreen.noDashboards')"
      icon="ep/monitor"
    />

    <div v-else class="screen-grid">
      <section
        v-for="card in currentCards"
        :key="`${currentDashboard?.pk}-${card.id}`"
        class="screen-card"
        :class="{
          'col-span-3': (card.span ?? 6) === 3,
          'col-span-6': (card.span ?? 6) === 6,
          'col-span-9': (card.span ?? 6) === 9,
          'col-span-12': (card.span ?? 6) === 12
        }"
      >
        <div class="screen-card__title">{{ card.title }}</div>
        <!-- 高度跟随卡片配置（与仪表盘页所见即所得），缺省 224 兼容存量布局 -->
        <div
          class="screen-card__body"
          :class="{
            'screen-card__body--plain': card.chart_type === 'number'
          }"
          :style="{ height: `${card.height ?? 224}px` }"
        >
          <ChartCard
            :key="`${currentDashboard?.pk}-${card.id}`"
            :ref="setCardRef(card.id)"
            :card="card"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<style lang="scss" scoped>
/* 恒深色投屏页（刻意不随站点主题）：色值按深色设计基线写定 */
.screen-root {
  background: #070b14;
}

.screen-ambient {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(
      1100px 520px at 18% -10%,
      rgb(64 158 255 / 16%),
      transparent 62%
    ),
    radial-gradient(
      900px 480px at 100% 0%,
      rgb(154 102 228 / 14%),
      transparent 58%
    ),
    linear-gradient(180deg, #0b1220 0%, #070b14 100%);
}

/* 顶部工具条与卡片同一视觉语言：半透明玻璃 + 细分隔线 */
.screen-header {
  position: relative;
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 14px 24px;
  margin-bottom: 4px;
  background: rgb(255 255 255 / 3%);
  border-bottom: 1px solid rgb(255 255 255 / 6%);
  backdrop-filter: blur(8px);
}

.screen-title {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

/* 看板名：同层级内的次要信息（字号与透明度降一档） */
.screen-subtitle {
  font-size: var(--el-font-size-base);
  font-weight: 400;
  color: rgb(255 255 255 / 62%);
}

.screen-page {
  padding: 1px 8px;
  font-size: var(--el-font-size-extra-small);
  color: rgb(255 255 255 / 70%);
  background: rgb(255 255 255 / 8%);
  border-radius: 999px;
}

.screen-clock {
  font-size: 18px;
  font-variant-numeric: tabular-nums;
  color: rgb(255 255 255 / 85%);
}

.screen-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 16px;
  padding: 4px 24px 24px;
}

.screen-card {
  position: relative;
  padding: 12px 14px 14px;
  background: rgb(255 255 255 / 4%);
  border: 1px solid rgb(255 255 255 / 8%);
  border-radius: 12px;
  box-shadow: 0 8px 28px rgb(0 0 0 / 26%);
  backdrop-filter: blur(6px);
}

.screen-card__title {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
  font-size: var(--el-font-size-small);
  color: rgb(255 255 255 / 82%);

  &::before {
    width: 3px;
    height: 12px;
    content: "";
    background: var(--el-color-primary);
    border-radius: 2px;
  }
}

/* 图表内层用站点主题底色：图表按主题渲染，在深色卡片里保持清晰（画框式层次）；
   文字取主题文本色，避免浅底上出现白字 */
.screen-card__body {
  overflow: hidden;
  color: var(--el-text-color-primary);
  background: var(--el-bg-color-overlay);
  border-radius: 8px;

  /* 指标卡（大数字）：不做画框内层，数字直接浮在深色卡上（白色醒目） */
  &--plain {
    color: inherit;
    background: transparent;
    border-radius: 0;
  }
}

/* 恒深色页的空态：文字与底托取白色透明度（不随站点主题的深浅） */
.screen-root :deep(.el-empty__description p) {
  color: rgb(255 255 255 / 62%);
}

.screen-root :deep(.re-empty-art) {
  color: rgb(255 255 255 / 78%);
  background: rgb(255 255 255 / 8%);
}
</style>
