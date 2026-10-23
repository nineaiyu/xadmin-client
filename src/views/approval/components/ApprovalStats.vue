<script lang="ts" setup>
import { isSuccess } from "@/api/types";
import { computed, onActivated, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { approvalApi } from "@/api/approval/approval";
import { StatGrid, type StatItem } from "@/components/ReStat";
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
 * 业务接入方（如请假页）再传 labelKeys 覆盖统计卡标题（指标结构相同时直接复用）。
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
    /** 统计卡标题的 i18n key 覆盖（默认审批中心口径） */
    labelKeys?: {
      submitted?: string;
      approved?: string;
      rejected?: string;
      pending?: string;
    };
    /** 统计口径提示文案 key 覆盖（默认 approval.statsTip） */
    tipKey?: string;
  }>(),
  {
    loader: undefined,
    authCode: "stats:SystemApprovalRequest",
    showAvgDuration: true,
    labelKeys: undefined,
    tipKey: "approval.statsTip"
  }
);

const { t } = useI18n();
// 权限表是响应式 pinia 状态：用 computed 跟随角色切换/权限刷新
const allowed = computed(() => hasAuth(props.authCode));
const loading = ref(false);
const stats = ref<ApprovalStatsData | null>(null);

const labels = computed(() => ({
  submitted: props.labelKeys?.submitted ?? "approval.statsSubmitted",
  approved: props.labelKeys?.approved ?? "approval.statsApproved",
  rejected: props.labelKeys?.rejected ?? "approval.statsRejected",
  pending: props.labelKeys?.pending ?? "approval.statsPending"
}));

/** 平均审批时长：秒 → 可读文案（保留一位小数的分钟/小时） */
const avgDuration = computed(() => {
  const seconds = stats.value?.avg_approval_seconds;
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
});

/** 统计卡条目：实例统计无「平均审批时长」指标，按 showAvgDuration 收口 */
const statItems = computed<StatItem[]>(() => {
  const data = stats.value;
  const items: StatItem[] = [
    {
      key: "submitted",
      label: t(labels.value.submitted),
      value: data?.submitted ?? 0
    },
    {
      key: "approved",
      label: t(labels.value.approved),
      value: data?.approved ?? 0
    },
    {
      key: "rejected",
      label: t(labels.value.rejected),
      value: data?.rejected ?? 0
    },
    {
      key: "pending",
      label: t(labels.value.pending),
      value: data?.pending ?? 0
    }
  ];
  if (props.showAvgDuration) {
    items.push({
      key: "avg",
      label: t("approval.statsAvgDuration"),
      text: avgDuration.value
    });
  }
  return items;
});

function fetchStats() {
  if (!allowed.value) return;
  loading.value = true;
  const load = props.loader ?? approvalApi.stats;
  load()
    .then(res => {
      if (isSuccess(res) && res.data) {
        stats.value = res.data as ApprovalStatsData;
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
  <el-card v-if="allowed" v-loading="loading" shadow="never" class="mb-2">
    <!-- 白底卡片与页面其余区域（搜索/表格区）观感一致，避免统计数字裸在灰底上；
         宽度由页面骨架统一提供，不再自带 w-99/100 模拟 -->
    <el-alert
      type="info"
      :closable="false"
      :title="t(tipKey, { n: stats?.days ?? 30 })"
      class="mb-2"
    />
    <!-- 统计卡等分：grid 等分（窄屏 2 列、sm 3 列回退），卡面与下方列表卡等宽 -->
    <StatGrid
      :items="statItems"
      :columns="showAvgDuration ? 5 : 4"
      :sm-columns="3"
    />
  </el-card>
</template>
