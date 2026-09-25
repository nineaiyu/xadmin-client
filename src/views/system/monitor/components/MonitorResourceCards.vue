<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { epColor } from "@/utils/chartTheme";
import { formatRate } from "../utils/format";

/**
 * 实时资源卡片：CPU / 内存 / 磁盘（进度环）+ 负载 + 网络速率。
 *
 * 纯展示：卡片数据（含文案）由页面侧组装，这里只负责渲染。
 */
type ResourceCard = {
  key: string;
  label: string;
  value: number;
  suffix: string;
  ring: boolean;
};

type NetRates = {
  sent?: number | null;
  recv?: number | null;
  sentTotal?: number | null;
  recvTotal?: number | null;
};

defineProps<{
  cards: ResourceCard[];
  netRates: NetRates;
}>();

const { t } = useI18n();
</script>

<template>
  <!-- 实时资源卡片：窄屏两列、中屏三列、宽屏一行五张 -->
  <div class="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
    <el-card v-for="card in cards" :key="card.key" shadow="hover">
      <div class="text-sm text-(--el-text-color-regular)">{{ card.label }}</div>
      <el-progress
        v-if="card.ring"
        class="mt-2"
        type="dashboard"
        :percentage="Math.min(100, Math.round(Number(card.value) || 0))"
        :color="
          Number(card.value) > 80 ? epColor('danger') : epColor('primary')
        "
      >
        <span class="text-lg">{{ card.value }}{{ card.suffix }}</span>
      </el-progress>
      <div v-else class="mt-2 flex-c h-30">
        <span class="text-3xl font-medium">
          {{ card.value }}{{ card.suffix }}
        </span>
      </div>
    </el-card>
    <el-card shadow="hover" data-testid="monitor-network-card">
      <div class="text-sm text-(--el-text-color-regular)">
        {{ t("systemMonitor.netRate") }}
      </div>
      <div class="mt-4 flex flex-col gap-2">
        <div class="flex-bc text-sm">
          <span class="text-(--el-text-color-regular)">{{
            t("systemMonitor.netSent")
          }}</span>
          <span class="font-medium">{{ formatRate(netRates.sent) }}</span>
        </div>
        <div class="flex-bc text-sm">
          <span class="text-(--el-text-color-regular)">{{
            t("systemMonitor.netRecv")
          }}</span>
          <span class="font-medium">{{ formatRate(netRates.recv) }}</span>
        </div>
        <div class="text-xs text-(--el-text-color-secondary)">
          {{
            t("systemMonitor.netTotal", {
              sent: netRates.sentTotal ?? 0,
              recv: netRates.recvTotal ?? 0
            })
          }}
        </div>
      </div>
    </el-card>
  </div>
</template>
