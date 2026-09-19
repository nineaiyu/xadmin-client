<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { MonitorCelery, MonitorRedisInfo } from "@/api/system/monitor";
import { formatUptime } from "../utils/hook";

/**
 * 三列状态面板：服务健康（含运行时信息）+ Redis + Celery worker。
 *
 * 纯展示：服务探活结果、Redis 信息与 worker 队列均由页面侧拉取后传入。
 */
type ServiceItem = {
  key: string;
  label: string;
  ok: boolean;
  cost?: number | string;
};

type RuntimeItem = { key: string; label: string; value: string };

const props = defineProps<{
  serviceItems: ServiceItem[];
  runtimeItems: RuntimeItem[];
  redis?: MonitorRedisInfo["redis"];
  celery: MonitorCelery;
  queues: [string, number][];
  /** 最近一次采集（决定 uptime 行是否展示，与页面侧原「有 latest 即展示」口径一致） */
  latest?: { boot_time: number } | null;
}>();

const { t } = useI18n();
/** 后端未就绪时 redis 可能整体缺失，统一回落到空对象（与页面侧原口径一致） */
const info = computed(() => props.redis ?? {});
</script>

<template>
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
        <div v-if="latest" class="mt-4 text-xs text-gray-400">
          {{ t("systemMonitor.uptime") }}: {{ formatUptime(latest.boot_time) }}
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
            <span class="text-gray-500">{{ t("systemMonitor.version") }}</span>
            <span>{{ info.version ?? "—" }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500">{{
              t("systemMonitor.usedMemory")
            }}</span>
            <span>{{ info.used_memory_human ?? "—" }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500">{{ t("systemMonitor.hitRate") }}</span>
            <span>{{ info.hit_rate == null ? "—" : `${info.hit_rate}%` }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500">{{ t("systemMonitor.clients") }}</span>
            <span>{{ info.connected_clients ?? "—" }}</span>
          </div>
          <div
            v-for="(keys, db) in info.dbs ?? {}"
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
</template>
