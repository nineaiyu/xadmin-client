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
  <div class="screen-root fixed inset-0 overflow-auto bg-gray-900 text-white">
    <div class="flex items-center gap-3 px-6 py-3">
      <span class="text-xl font-semibold tracking-wide">
        {{ screen?.name }} · {{ currentDashboard?.name }}
      </span>
      <span class="text-sm text-gray-400">
        {{ pageIndex + 1 }} / {{ dashboards.length }}
      </span>
      <!-- 远程接管指示：manual 态停本地轮播，回到 auto 后指示消失 -->
      <el-tag
        v-if="controlMode === 'manual'"
        size="small"
        type="warning"
        effect="dark"
      >
        远程控制中
      </el-tag>
      <div class="flex-1" />
      <span class="font-mono text-lg text-gray-300">{{ clock }}</span>
      <el-button
        size="small"
        :loading="exporting"
        data-testid="screen-export"
        @click="exportScreen"
      >
        {{ t("dataScreen.exportScreen") }}
      </el-button>
      <el-button size="small" @click="paused = !paused">
        {{ paused ? "▶" : "⏸" }}
      </el-button>
      <el-button size="small" @click="toggleFullscreen">⛶</el-button>
    </div>

    <el-empty
      v-if="dashboards.length === 0"
      :description="t('dataScreen.noDashboards')"
    />

    <div v-else class="grid grid-cols-12 gap-3 px-6 pb-6">
      <div
        v-for="card in currentCards"
        :key="`${currentDashboard?.pk}-${card.id}`"
        class="rounded-lg bg-gray-800/70 p-3"
        :class="{
          'col-span-3': (card.span ?? 6) === 3,
          'col-span-6': (card.span ?? 6) === 6,
          'col-span-9': (card.span ?? 6) === 9,
          'col-span-12': (card.span ?? 6) === 12
        }"
      >
        <div class="mb-2 text-sm text-gray-300">{{ card.title }}</div>
        <!-- 高度跟随卡片配置（与仪表盘页所见即所得），缺省 224 兼容存量布局 -->
        <div :style="{ height: `${card.height ?? 224}px` }">
          <ChartCard
            :key="`${currentDashboard?.pk}-${card.id}`"
            :ref="setCardRef(card.id)"
            :card="card"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.screen-root :deep(.el-empty__description p) {
  color: #9ca3af;
}
</style>
