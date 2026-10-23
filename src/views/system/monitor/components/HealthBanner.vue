<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { MonitorHealth } from "@/api/system/monitor";
import { epColor } from "@/utils/chartTheme";

defineOptions({ name: "MonitorHealthBanner" });

const props = defineProps<{
  health: MonitorHealth | null;
  /** 概览接口失败：与「尚未加载」区分，横幅显式显示未知而不是健康 0% */
  unavailable?: boolean;
}>();

const { t } = useI18n();

const STATUS_META = {
  healthy: { tag: "success", key: "systemMonitor.healthHealthy" },
  warning: { tag: "warning", key: "systemMonitor.healthWarning" },
  critical: { tag: "danger", key: "systemMonitor.healthCritical" }
} as const;

const ITEM_STATUS_KEY: Record<string, string> = {
  healthy: "systemMonitor.healthy",
  warning: "systemMonitor.itemWarning",
  critical: "systemMonitor.itemCritical",
  unknown: "systemMonitor.itemUnknown"
};

const status = computed(() => props.health?.status ?? null);
// 未知状态（后端新增档位/异常数据）回退健康档：直接取键会拿到 undefined 致渲染崩溃
const meta = computed(() =>
  status.value
    ? (STATUS_META[status.value] ?? STATUS_META.healthy)
    : { tag: "info" as const, key: "systemMonitor.healthUnknown" }
);
// null = 未获取（接口失败 / 尚未加载），不能按 0 分渲染
const score = computed(() => props.health?.score ?? null);
const items = computed(() => props.health?.items ?? []);
const firing = computed(() => props.health?.alerts?.firing ?? 0);

const scoreColor = computed(() =>
  status.value === "critical"
    ? epColor("danger")
    : status.value === "warning"
      ? epColor("warning")
      : status.value === "healthy"
        ? epColor("success")
        : epColor("info")
);

const checkedAt = computed(() =>
  props.health?.checked_at ? props.health.checked_at.slice(11, 19) : "—"
);

const itemTagType = (itemStatus: string) =>
  itemStatus === "critical"
    ? "danger"
    : itemStatus === "warning"
      ? "warning"
      : itemStatus === "unknown"
        ? "info"
        : "success";
</script>

<template>
  <el-card
    shadow="never"
    class="mb-4"
    data-testid="monitor-health-banner"
    :title="unavailable ? t('systemMonitor.dataUnavailable') : undefined"
  >
    <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div class="flex items-center gap-4">
        <el-progress
          v-if="score !== null"
          type="circle"
          :percentage="score"
          :width="68"
          :stroke-width="8"
          :color="scoreColor"
        />
        <div v-else class="health-unknown" data-testid="monitor-health-unknown">
          —
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-sm text-(--el-text-color-regular)">
            {{ t("systemMonitor.healthOverview") }}
          </span>
          <span data-testid="monitor-health-status">
            <el-tag :type="meta.tag" size="small" effect="dark">
              {{ t(meta.key) }}
            </el-tag>
          </span>
        </div>
      </div>
      <el-divider direction="vertical" class="hidden! md:block!" />
      <div class="flex flex-wrap items-center gap-2">
        <el-tag
          v-for="item in items"
          :key="item.key"
          :type="itemTagType(item.status)"
          size="small"
          effect="plain"
        >
          <span class="font-medium">{{ item.label }}</span>
          <template v-if="item.group === 'resource'">
            ：{{ item.value ?? "—" }}{{ item.unit ?? ""
            }}<span class="text-(--el-text-color-secondary)">
              / {{ item.threshold }}{{ item.unit ?? "" }}</span
            >
          </template>
          <template v-else>
            ：{{
              t(ITEM_STATUS_KEY[item.status] ?? "systemMonitor.itemUnknown")
            }}
          </template>
        </el-tag>
      </div>
      <div
        class="ml-auto flex items-center gap-4 text-xs text-(--el-text-color-regular)"
      >
        <span>
          {{ t("systemMonitor.alertsFiring") }}：
          <b :class="firing > 0 ? 'text-red-500' : ''">{{ firing }}</b>
        </span>
        <span>{{ t("systemMonitor.checkedAt") }}：{{ checkedAt }}</span>
      </div>
    </div>
  </el-card>
</template>
<style scoped lang="scss">
.health-unknown {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 68px;
  height: 68px;
  color: var(--el-text-color-secondary);
  border: 6px solid var(--el-border-color-lighter);
  border-radius: 50%;
}
</style>
