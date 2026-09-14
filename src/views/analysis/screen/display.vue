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
import ChartCard from "@/views/dashboard/components/ChartCard.vue";

defineOptions({
  name: "DataScreenDisplay"
});

/**
 * 大屏投屏：全屏轮播 Screen 内的仪表盘，按 refresh 秒自动重拉数据。
 * 权限复用仪表盘可见性：对当前浏览者不可见的仪表盘自动跳过。
 * 图表渲染复用一期的 ChartCard（defineExpose loadData 供定时刷新）。
 */

const route = useRoute();

const screen = ref<ScreenItem | null>(null);
const dashboards = ref<DashboardItem[]>([]);
const pageIndex = ref(0);
const paused = ref(false);
const clock = ref("");

const currentDashboard = computed(
  () => dashboards.value[pageIndex.value] ?? null
);
const currentCards = computed<DashboardCard[]>(
  () => currentDashboard.value?.layout ?? []
);

/** 卡片刷新句柄：模板 ref 收集 ChartCard 的 loadData */
const cardLoaders = ref<Record<string, (() => void) | undefined>>({});
const setCardRef = (cardId: string) => (el: unknown) => {
  const loader = el as { loadData?: () => void } | null;
  if (loader?.loadData) cardLoaders.value[cardId] = loader.loadData;
};

const refreshVisible = () => {
  for (const card of currentCards.value) {
    cardLoaders.value[card.id]?.();
  }
};

let pageTimer: number | undefined;
let refreshTimer: number | undefined;
let clockTimer: number | undefined;

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
    if (paused.value || dashboards.value.length === 0) return;
    pageIndex.value = (pageIndex.value + 1) % dashboards.value.length;
  }, interval);
  refreshTimer = window.setInterval(refreshVisible, refresh);
  clockTimer = window.setInterval(() => {
    clock.value = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  }, 1000);
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
  screen.value = res.data as never;
  // 仅保留浏览者可见的仪表盘（personal 对他人不在可见列表内）
  const all = listRows<DashboardItem>(
    (await fetchAllRows(dashboardApi.list)) as never
  );
  dashboards.value = (screen.value?.dashboards ?? [])
    .map(id => all.find(item => item.pk === id))
    .filter((item): item is DashboardItem => Boolean(item));
  startTimers();
});

onBeforeUnmount(stopTimers);
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
      <div class="flex-1" />
      <span class="font-mono text-lg text-gray-300">{{ clock }}</span>
      <el-button size="small" @click="paused = !paused">
        {{ paused ? "▶" : "⏸" }}
      </el-button>
      <el-button size="small" @click="toggleFullscreen">⛶</el-button>
    </div>

    <el-empty v-if="dashboards.length === 0" description="无可投屏仪表盘" />

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
