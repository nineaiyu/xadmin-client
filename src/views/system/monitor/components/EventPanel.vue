<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  monitorApi,
  type MonitorErrorEvent,
  type MonitorTaskEvent
} from "@/api/system/monitor";
import {
  ReReadonlyTable,
  type ReadonlyColumn
} from "@/components/ReReadonlyTable";

defineOptions({ name: "MonitorEventPanel" });

const { t } = useI18n();

const EVENT_RANGES = ["1h", "24h", "7d", "30d"];
const RANGE_LABEL_KEYS: Record<string, string> = {
  "1h": "range1h",
  "24h": "range24h",
  "7d": "range7d",
  "30d": "range30d"
};

const activeKind = ref<"error" | "task">("error");
const range = ref("24h");
const loading = ref(false);
const errorRows = ref<MonitorErrorEvent[]>([]);
const taskRows = ref<MonitorTaskEvent[]>([]);

const fetchEvents = async () => {
  loading.value = true;
  try {
    // 两类事件独立展示，单个接口失败不拖垮另一类
    const results = await Promise.allSettled([
      monitorApi.events({ kind: "error", range: range.value }),
      monitorApi.events({ kind: "task", range: range.value })
    ]);
    if (results[0].status === "fulfilled")
      errorRows.value = results[0].value.data.results as MonitorErrorEvent[];
    if (results[1].status === "fulfilled")
      taskRows.value = results[1].value.data.results as MonitorTaskEvent[];
  } finally {
    loading.value = false;
  }
};

const onRangeChange = () => fetchEvents();

/** 面板内嵌密集表：显式取紧凑档（此处密度优先于与列表页行高对齐） */
const errorColumns = computed<ReadonlyColumn[]>(() => [
  { prop: "created_time", label: t("systemMonitor.time"), width: 170 },
  {
    prop: "module",
    label: t("systemMonitor.module"),
    minWidth: 140,
    showOverflowTooltip: true
  },
  {
    prop: "path",
    label: t("systemMonitor.path"),
    minWidth: 200,
    showOverflowTooltip: true
  },
  { prop: "method", label: t("systemMonitor.method"), width: 80 },
  { label: t("systemMonitor.bizCode"), width: 90, slot: "status_code" },
  { label: t("systemMonitor.cost"), width: 100, slot: "exec_time" },
  { prop: "creator__username", label: t("systemMonitor.creator"), width: 110 },
  { prop: "ipaddress", label: t("systemMonitor.ip"), width: 130 }
]);

const taskColumns = computed<ReadonlyColumn[]>(() => [
  {
    prop: "name",
    label: t("systemMonitor.taskName"),
    minWidth: 200,
    showOverflowTooltip: true
  },
  { label: t("systemMonitor.taskState"), width: 120, slot: "status" },
  { prop: "date_start", label: t("systemMonitor.taskStart"), width: 180 },
  { prop: "date_finished", label: t("systemMonitor.taskFinished"), width: 180 }
]);

onMounted(fetchEvents);

defineExpose({ refresh: fetchEvents });
</script>

<template>
  <el-card shadow="never" data-testid="monitor-event-panel">
    <template #header>
      <div class="flex flex-wrap items-center gap-3">
        <span>{{ t("systemMonitor.events") }}</span>
        <el-radio-group v-model="range" size="small" @change="onRangeChange">
          <el-radio-button
            v-for="item in EVENT_RANGES"
            :key="item"
            :value="item"
          >
            {{ t(`systemMonitor.${RANGE_LABEL_KEYS[item]}`) }}
          </el-radio-button>
        </el-radio-group>
        <div class="flex-1" />
        <el-button link type="primary" :loading="loading" @click="fetchEvents">
          {{ t("systemMonitor.refresh") }}
        </el-button>
      </div>
    </template>
    <el-tabs v-model="activeKind">
      <el-tab-pane :label="t('systemMonitor.errorEvents')" name="error">
        <ReReadonlyTable
          :columns="errorColumns"
          :rows="errorRows"
          :loading="loading"
          size="small"
          :empty-text="t('systemMonitor.noErrorEvent')"
        >
          <template #status_code="{ row }">
            <el-tag type="danger" size="small">{{ row.status_code }}</el-tag>
          </template>
          <template #exec_time="{ row }">
            {{
              typeof row.exec_time === "number"
                ? `${Number(row.exec_time).toFixed(3)}s`
                : "—"
            }}
          </template>
        </ReReadonlyTable>
      </el-tab-pane>
      <el-tab-pane :label="t('systemMonitor.taskEvents')" name="task">
        <ReReadonlyTable
          :columns="taskColumns"
          :rows="taskRows"
          :loading="loading"
          size="small"
          :empty-text="t('systemMonitor.taskNoFailures')"
        >
          <template #status="{ row }">
            <el-tag
              :type="row.status === 'FAILURE' ? 'danger' : 'warning'"
              size="small"
            >
              {{ row.status }}
            </el-tag>
          </template>
        </ReReadonlyTable>
      </el-tab-pane>
    </el-tabs>
  </el-card>
</template>
