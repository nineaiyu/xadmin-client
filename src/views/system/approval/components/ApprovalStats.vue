<script lang="ts" setup>
import { SUCCESS_CODE } from "@/api/types";
import { computed, onActivated, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { approvalApi } from "@/api/system/approval";
import { registerApprovalStatsRefresh } from "@/utils/approvalStats";

defineOptions({ name: "ApprovalStats" });

/**
 * 审批统计卡片（近 30 天）：我提交 / 我通过 / 我驳回 / [平均审批时长] / 待我审批。
 *
 * 自发起请求（内容组件范式，同 MaskPreview / PatCallLogs）；按权限码 stats 收口，
 * 无权限时整块不渲染，也不发请求。
 *
 * 双轨复用：默认轻量敏感操作审批；流程审批实例页传 loader/authCode 并关闭
 * 「平均审批时长」卡（实例统计无该指标），避免两份结构相同的统计卡实现。
 */
type ApprovalStatsData = {
  days: number;
  submitted: number;
  approved: number;
  rejected: number;
  avg_approval_seconds?: number | null;
  pending: number;
};

type StatsLoader = () => Promise<{ code?: number; data?: unknown }>;

const props = withDefaults(
  defineProps<{
    /** 统计接口（默认轻量审批） */
    loader?: StatsLoader;
    /** 权限码（默认 stats:SystemApprovalRequest） */
    authCode?: string;
    /** 是否展示「平均审批时长」卡 */
    showAvgDuration?: boolean;
  }>(),
  {
    loader: undefined,
    authCode: "stats:SystemApprovalRequest",
    showAvgDuration: true
  }
);

const { t } = useI18n();
const allowed = hasAuth(props.authCode);
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

function fetchStats() {
  if (!allowed) return;
  loading.value = true;
  const load = props.loader ?? approvalApi.stats;
  load()
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
}

let unregister: (() => void) | undefined;

onMounted(() => {
  fetchStats();
  // 审批动作成功后由 refreshApprovalStats() 触发（轻量审批 / 流程实例两轨共用）
  unregister = registerApprovalStatsRefresh(fetchStats);
});

/** keep-alive 页面切回时重拉：离开期间在其它页面发生的审批动作不会漏刷 */
onActivated(fetchStats);

onUnmounted(() => unregister?.());

/** 供父级在操作后刷新（如发起申请、批量审批成功） */
defineExpose({ refresh: fetchStats });
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
    <!-- 统计卡等分：el-col 的整数跨度无法均分 24（4,4,4,4,6 会留 2/24 空档），
         改 grid 等分（窄屏 2 列回退），卡面与下方列表卡等宽 -->
    <div
      class="grid grid-cols-2 gap-3 sm:grid-cols-3"
      :class="showAvgDuration ? 'md:grid-cols-5' : 'md:grid-cols-4'"
    >
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
      <el-statistic
        v-if="showAvgDuration"
        :title="t('approval.statsAvgDuration')"
      >
        <template #default>{{ avgDuration }}</template>
      </el-statistic>
    </div>
  </el-card>
</template>
