<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { loadEcharts } from "@/plugins/echarts";
import TrendChart from "./components/TrendChart.vue";
import TaskHealthCard from "./components/TaskHealthCard.vue";
import { formatUptime, useMonitor } from "./utils/hook";

defineOptions({
  name: "SystemMonitor" // 必须定义，用于菜单自动匹配组件
});

const { t } = useI18n();
// echarts 懒加载就绪后再渲染图表（useECharts 初始化时同步读取 $echarts，见 welcome 同款处理）
const echartsReady = ref(false);
onMounted(async () => {
  await loadEcharts();
  echartsReady.value = true;
});

const {
  loading,
  autoRefresh,
  wsConnected,
  overview,
  services,
  redisInfo,
  celery,
  slow,
  taskHealth,
  fetchAll,
  toggleAuto,
  start
} = useMonitor();

const resourceCards = computed(() => {
  // live 为 psutil 实时快照；采集失败回退心跳最新值（30s 落盘）
  const current = overview.value.live ?? overview.value.latest;
  return [
    {
      key: "cpu",
      label: t("systemMonitor.cpu"),
      value: current?.cpu_percent ?? 0,
      suffix: "%"
    },
    {
      key: "memory",
      label: t("systemMonitor.memory"),
      value: current?.memory_used ?? 0,
      suffix: "%"
    },
    {
      key: "disk",
      label: t("systemMonitor.disk"),
      value: current?.disk_used ?? 0,
      suffix: "%"
    },
    {
      key: "load",
      label: t("systemMonitor.load"),
      value: current?.cpu_load ?? 0,
      suffix: ""
    }
  ];
});

const runtimeItems = computed(() => {
  const live = overview.value.live;
  if (!live) return [];
  return [
    {
      key: "cores",
      label: t("systemMonitor.cores"),
      value: String(live.cpu_count ?? "—")
    },
    {
      key: "processes",
      label: t("systemMonitor.processes"),
      value: String(live.process_count ?? "—")
    },
    {
      key: "swap",
      label: t("systemMonitor.swap"),
      value: `${live.swap_percent ?? 0}%`
    },
    {
      key: "net",
      label: t("systemMonitor.netIo"),
      value: `↑${live.net_sent_mb ?? 0}MB ↓${live.net_recv_mb ?? 0}MB`
    }
  ];
});

const serviceItems = computed(() => {
  const items = services.value;
  return [
    {
      key: "db",
      label: t("systemMonitor.db"),
      ok: items?.db.status ?? false,
      cost: items?.db.cost
    },
    {
      key: "redis",
      label: t("systemMonitor.redis"),
      ok: items?.redis.status ?? false,
      cost: items?.redis.cost
    },
    {
      key: "celery",
      label: t("systemMonitor.celery"),
      ok: items?.celery.status ?? false,
      cost: items?.celery.cost
    }
  ];
});

const redis = computed(() => redisInfo.value.redis ?? {});
const queues = computed(
  () =>
    Object.entries(redisInfo.value.queues ?? {}).filter(
      entry => typeof entry[1] === "number"
    ) as [string, number][]
);
const slowRows = computed(() => slow.value.results ?? []);
start();
</script>

<template>
  <div class="main">
    <el-card shadow="never" class="mb-4">
      <div class="flex-bc">
        <span class="font-medium">{{ t("menus.systemMonitor") }}</span>
        <div class="flex items-center gap-3">
          <el-tag
            :type="wsConnected ? 'success' : 'info'"
            size="small"
            effect="plain"
          >
            {{
              wsConnected
                ? t("systemMonitor.wsLive")
                : t("systemMonitor.wsFallback")
            }}
          </el-tag>
          <el-switch
            v-model="autoRefresh"
            :active-text="t('systemMonitor.autoRefresh')"
            @change="value => toggleAuto(Boolean(value))"
          />
          <el-button
            type="primary"
            plain
            :loading="loading"
            @click="() => fetchAll(true)"
          >
            {{ t("systemMonitor.refresh") }}
          </el-button>
        </div>
      </div>
    </el-card>

    <el-row :gutter="16" class="mb-4">
      <el-col v-for="card in resourceCards" :key="card.key" :xs="12" :sm="6">
        <el-card shadow="hover">
          <div class="text-sm text-gray-500">{{ card.label }}</div>
          <el-progress
            class="mt-2"
            type="dashboard"
            :percentage="Math.min(100, Math.round(Number(card.value) || 0))"
            :color="Number(card.value) > 80 ? '#f56c6c' : '#409eff'"
          >
            <span class="text-lg">{{ card.value }}{{ card.suffix }}</span>
          </el-progress>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" class="mb-4">
      <template #header>{{ t("systemMonitor.trend") }}</template>
      <TrendChart v-if="echartsReady" :trend="overview.trend" />
    </el-card>

    <el-row :gutter="16" class="mb-4">
      <el-col :xs="24" :md="8">
        <el-card shadow="never">
          <template #header>{{ t("systemMonitor.serviceHealth") }}</template>
          <div class="flex flex-col gap-3">
            <div v-for="item in serviceItems" :key="item.key" class="flex-bc">
              <span class="flex items-center gap-2">
                <el-tag :type="item.ok ? 'success' : 'danger'" size="small">
                  {{
                    item.ok
                      ? t("systemMonitor.healthy")
                      : t("systemMonitor.unhealthy")
                  }}
                </el-tag>
                {{ item.label }}
              </span>
              <span class="text-xs text-gray-400">
                {{
                  typeof item.cost === "number"
                    ? `${(item.cost * 1000).toFixed(1)}ms`
                    : item.cost
                }}
              </span>
            </div>
          </div>
          <div v-if="overview.latest" class="mt-4 text-xs text-gray-400">
            {{ t("systemMonitor.uptime") }}:
            {{ formatUptime(overview.latest.boot_time) }}
          </div>
          <el-divider v-if="runtimeItems.length" class="my-3!" />
          <div
            v-for="item in runtimeItems"
            :key="item.key"
            class="flex-bc text-sm"
          >
            <span class="text-gray-500">{{ item.label }}</span>
            <span>{{ item.value }}</span>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="8">
        <el-card shadow="never">
          <template #header>{{ t("systemMonitor.redis") }}</template>
          <div class="flex flex-col gap-2 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-500">{{
                t("systemMonitor.version")
              }}</span>
              <span>{{ redis.version ?? "—" }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">{{
                t("systemMonitor.usedMemory")
              }}</span>
              <span>{{ redis.used_memory_human ?? "—" }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">{{
                t("systemMonitor.hitRate")
              }}</span>
              <span>{{
                redis.hit_rate == null ? "—" : `${redis.hit_rate}%`
              }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">{{
                t("systemMonitor.clients")
              }}</span>
              <span>{{ redis.connected_clients ?? "—" }}</span>
            </div>
            <div
              v-for="(keys, db) in redis.dbs ?? {}"
              :key="db"
              class="flex justify-between"
            >
              <span class="text-gray-500">{{ db }}</span>
              <span>{{ keys }}</span>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="8">
        <el-card shadow="never">
          <template #header>
            {{ t("systemMonitor.celery") }} ({{ celery.total }})
          </template>
          <el-table
            v-if="celery.workers.length"
            :data="celery.workers"
            size="small"
          >
            <el-table-column
              prop="name"
              :label="t('systemMonitor.worker')"
              min-width="140"
              show-overflow-tooltip
            />
            <el-table-column
              prop="concurrency"
              :label="t('systemMonitor.concurrency')"
              width="80"
            />
            <el-table-column
              prop="active"
              :label="t('systemMonitor.active')"
              width="70"
            />
            <el-table-column
              prop="reserved"
              :label="t('systemMonitor.reserved')"
              width="80"
            />
          </el-table>
          <div v-else class="text-sm text-gray-400">
            {{
              celery.skipped
                ? t("systemMonitor.celerySkipped")
                : t("systemMonitor.noWorker")
            }}
          </div>
          <div
            v-if="queues.length"
            class="mt-3 flex flex-wrap gap-3 text-xs text-gray-500"
          >
            <span v-for="[name, length] in queues" :key="name">
              {{ name }}: {{ length }}
            </span>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <task-health-card :health="taskHealth" />

    <el-card shadow="never">
      <template #header>
        {{ t("systemMonitor.slowRequests") }}
        (≥ {{ slow.threshold }}s / 24h)
      </template>
      <el-table :data="slowRows" size="small">
        <el-table-column
          prop="module"
          :label="t('systemMonitor.module')"
          min-width="160"
          show-overflow-tooltip
        />
        <el-table-column
          prop="path"
          :label="t('systemMonitor.path')"
          min-width="220"
          show-overflow-tooltip
        />
        <el-table-column
          prop="method"
          :label="t('systemMonitor.method')"
          width="80"
        />
        <el-table-column
          prop="exec_time"
          :label="t('systemMonitor.cost')"
          width="90"
        >
          <template #default="{ row }"
            >{{ Number(row.exec_time).toFixed(3) }}s</template
          >
        </el-table-column>
        <el-table-column
          prop="status_code"
          :label="t('systemMonitor.statusCode')"
          width="90"
        />
        <el-table-column
          prop="creator__username"
          :label="t('systemMonitor.creator')"
          width="110"
        />
        <el-table-column
          prop="created_time"
          :label="t('systemMonitor.time')"
          width="170"
        />
      </el-table>
      <el-empty
        v-if="!slowRows.length"
        :description="t('systemMonitor.noSlowRequest')"
        :image-size="60"
      />
    </el-card>
  </div>
</template>
