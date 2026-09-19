<script lang="ts" setup>
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  monitorApi,
  type MonitorErrorEvent,
  type MonitorTaskEvent
} from "@/api/system/monitor";

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
        <el-table v-loading="loading" :data="errorRows" size="small">
          <el-table-column
            prop="created_time"
            :label="t('systemMonitor.time')"
            width="170"
          />
          <el-table-column
            prop="module"
            :label="t('systemMonitor.module')"
            min-width="140"
            show-overflow-tooltip
          />
          <el-table-column
            prop="path"
            :label="t('systemMonitor.path')"
            min-width="200"
            show-overflow-tooltip
          />
          <el-table-column
            prop="method"
            :label="t('systemMonitor.method')"
            width="80"
          />
          <el-table-column
            prop="status_code"
            :label="t('systemMonitor.bizCode')"
            width="90"
          >
            <template #default="{ row }">
              <el-tag type="danger" size="small">{{ row.status_code }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column
            prop="exec_time"
            :label="t('systemMonitor.cost')"
            width="90"
          >
            <template #default="{ row }">
              {{
                typeof row.exec_time === "number"
                  ? `${Number(row.exec_time).toFixed(3)}s`
                  : "—"
              }}
            </template>
          </el-table-column>
          <el-table-column
            prop="creator__username"
            :label="t('systemMonitor.creator')"
            width="110"
          />
          <el-table-column
            prop="ipaddress"
            :label="t('systemMonitor.ip')"
            width="130"
          />
        </el-table>
        <el-empty
          v-if="!loading && !errorRows.length"
          :description="t('systemMonitor.noErrorEvent')"
          :image-size="60"
        />
      </el-tab-pane>
      <el-tab-pane :label="t('systemMonitor.taskEvents')" name="task">
        <el-table v-loading="loading" :data="taskRows" size="small">
          <el-table-column
            prop="name"
            :label="t('systemMonitor.taskName')"
            min-width="200"
            show-overflow-tooltip
          />
          <el-table-column
            prop="status"
            :label="t('systemMonitor.taskState')"
            width="120"
          >
            <template #default="{ row }">
              <el-tag
                :type="row.status === 'FAILURE' ? 'danger' : 'warning'"
                size="small"
              >
                {{ row.status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            prop="date_start"
            :label="t('systemMonitor.taskStart')"
            width="180"
          />
          <el-table-column
            prop="date_finished"
            :label="t('systemMonitor.taskFinished')"
            width="180"
          />
        </el-table>
        <el-empty
          v-if="!loading && !taskRows.length"
          :description="t('systemMonitor.taskNoFailures')"
          :image-size="60"
        />
      </el-tab-pane>
    </el-tabs>
  </el-card>
</template>
