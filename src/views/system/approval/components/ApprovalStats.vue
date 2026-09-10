<script lang="ts" setup>
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
      if (res.code === 1000 && res.data) {
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
  <div v-if="allowed" v-loading="loading" class="mx-3 mb-2 mt-4">
    <el-alert
      type="info"
      :closable="false"
      :title="t('approval.statsTip', { n: stats?.days ?? 30 })"
      class="mb-2"
    />
    <el-row :gutter="12">
      <el-col :xs="12" :sm="8" :md="4">
        <el-statistic
          :title="t('approval.statsSubmitted')"
          :value="stats?.submitted ?? 0"
        />
      </el-col>
      <el-col :xs="12" :sm="8" :md="4">
        <el-statistic
          :title="t('approval.statsApproved')"
          :value="stats?.approved ?? 0"
        />
      </el-col>
      <el-col :xs="12" :sm="8" :md="4">
        <el-statistic
          :title="t('approval.statsRejected')"
          :value="stats?.rejected ?? 0"
        />
      </el-col>
      <el-col :xs="12" :sm="8" :md="4">
        <el-statistic :title="t('approval.statsPending')">
          <template #default>
            <span>{{ stats?.pending ?? 0 }}</span>
          </template>
        </el-statistic>
      </el-col>
      <el-col :xs="12" :sm="8" :md="6">
        <el-statistic :title="t('approval.statsAvgDuration')">
          <template #default>{{ avgDuration }}</template>
        </el-statistic>
      </el-col>
    </el-row>
  </div>
</template>
