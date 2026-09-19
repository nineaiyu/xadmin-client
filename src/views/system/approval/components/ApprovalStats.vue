<script lang="ts" setup>
import { SUCCESS_CODE } from "@/api/types";
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { approvalApi } from "@/api/system/approval";

defineOptions({ name: "ApprovalStats" });

/**
 * 审批统计卡片（近 30 天）：我提交 / 我通过 / 我驳回 / 平均审批时长 / 待我审批。
 *
 * 自发起请求（内容组件范式，同 MaskPreview / PatCallLogs）；按权限码 stats 收口，
 * 无权限时整块不渲染，也不发请求。
 */
type ApprovalStatsData = {
  days: number;
  submitted: number;
  approved: number;
  rejected: number;
  avg_approval_seconds: number | null;
  pending: number;
};

const { t } = useI18n();
const allowed = hasAuth("stats:SystemApprovalRequest");
const loading = ref(false);
const stats = ref<ApprovalStatsData | null>(null);

/** 平均审批时长：秒 → 可读文案（保留一位小数的分钟/小时） */
const avgDuration = computed(() => {
  const seconds = stats.value?.avg_approval_seconds;
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
});

onMounted(() => {
  if (!allowed) return;
  loading.value = true;
  approvalApi
    .stats()
    .then(res => {
      if (res.code === SUCCESS_CODE && res.data) {
        stats.value = res.data as unknown as ApprovalStatsData;
      }
    })
    .catch(() => {
      // 统计属附加信息：失败保持空态，不打断列表
    })
    .finally(() => {
      loading.value = false;
    });
});
</script>

<template>
  <!-- 白底卡片与页面其余区域（搜索/表格区）观感一致，避免统计数字裸在灰底上；
       w-99/100 与 RePlusPage 的搜索/表格卡同宽，右边缘对齐（两者均为容器 99%） -->
  <el-card
    v-if="allowed"
    v-loading="loading"
    shadow="never"
    class="mb-2 w-99/100"
  >
    <el-alert
      type="info"
      :closable="false"
      :title="t('approval.statsTip', { n: stats?.days ?? 30 })"
      class="mb-2"
    />
    <!-- 5 张统计卡等分：el-col 的整数跨度无法均分 24（4,4,4,4,6 会留 2/24 空档），
         改 grid 五等分（窄屏 2 列回退），卡面与下方列表卡等宽 -->
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
      <el-statistic
        :title="t('approval.statsSubmitted')"
        :value="stats?.submitted ?? 0"
      />
      <el-statistic
        :title="t('approval.statsApproved')"
        :value="stats?.approved ?? 0"
      />
      <el-statistic
        :title="t('approval.statsRejected')"
        :value="stats?.rejected ?? 0"
      />
      <el-statistic :title="t('approval.statsPending')">
        <template #default>
          <span>{{ stats?.pending ?? 0 }}</span>
        </template>
      </el-statistic>
      <el-statistic :title="t('approval.statsAvgDuration')">
        <template #default>{{ avgDuration }}</template>
      </el-statistic>
    </div>
  </el-card>
</template>
