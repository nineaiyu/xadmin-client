<script lang="ts" setup>
import { computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import type { RecordType } from "plus-pro-components";
import { usePagedList } from "@/hooks/usePagedList";
import { operationLogApi } from "@/api/audit/logs/operation";
import {
  ReReadonlyTable,
  type ReadonlyColumn
} from "@/components/ReReadonlyTable";

defineOptions({ name: "ApprovalLogsDialog" });

/**
 * 审批单 → 相关操作日志（互跳抽屉内容）。
 *
 * **近似口径**：审批单与操作日志之间没有强关联字段，按「同请求路径 + 同对象主键 +
 * 同申请人」回溯该审批单对应的敏感操作痕迹，并展示在弹窗提示里（不做精确断言，
 * 避免误读为「本次审批生成的操作」）。
 */
const props = defineProps<{
  path: string;
  objectPk?: string | null;
  creatorPk?: number | string | null;
}>();

/** 后端 creator 为嵌套对象（OperationLogSerializer: attrs=[pk,username] + format），
 * 字段权限裁剪时可能退化为裸 pk，故类型按并集声明 */
type LogCreator = { pk?: number | string; username?: string; label?: string };

type LogRow = RecordType & {
  created_time: string;
  creator?: LogCreator | number | string | null;
  method: string;
  path: string;
  status_code: number | null;
};

/** creator 不能直接 prop 绑定（对象会渲染成 [object Object]），与操作日志页同口径取 username */
const formatCreator = (creator: LogRow["creator"]) => {
  if (creator === null || creator === undefined) return "/";
  if (typeof creator === "object")
    return creator.username ?? creator.label ?? "/";
  return String(creator);
};

const { t } = useI18n();

const PAGE_SIZE = 10;

/** 相关日志只读列（创建人取 username，不直接绑定嵌套对象） */
const columns = computed<ReadonlyColumn[]>(() => [
  { prop: "created_time", label: t("logsOperation.created_time"), width: 160 },
  {
    prop: "creator",
    label: t("logsOperation.creator"),
    width: 120,
    showOverflowTooltip: true,
    slot: "creator"
  },
  { prop: "method", label: t("logsOperation.method"), width: 90 },
  {
    prop: "path",
    label: t("logsOperation.path"),
    minWidth: 200,
    showOverflowTooltip: true
  },
  { prop: "status_code", label: t("logsOperation.status_code"), width: 90 }
]);

// 相关日志分页（异常归一与信封判定见 usePagedList；翻页失败保持现状不清空）
const {
  loading,
  page,
  total,
  rows,
  load: fetchLogs,
  setPage
} = usePagedList<LogRow>({
  pageSize: PAGE_SIZE,
  fetch: params =>
    operationLogApi.list({
      ...params,
      // path_exact 精确匹配审批单的请求路径（避免前缀命中同模块其他接口）
      path_exact: props.path,
      ...(props.objectPk ? { object_pk: props.objectPk } : {}),
      ...(props.creatorPk ? { creator: props.creatorPk } : {})
    }),
  pickRows: res => (res.data as { results?: LogRow[] } | null)?.results ?? []
});

const pagination = computed(() => ({
  total: total.value,
  page: page.value,
  pageSize: PAGE_SIZE
}));

onMounted(fetchLogs);
</script>

<template>
  <div>
    <el-alert
      type="info"
      :closable="false"
      :title="t('approval.relatedLogsTip')"
      class="mb-3"
    />
    <ReReadonlyTable
      :columns="columns"
      :rows="rows"
      :loading="loading"
      :pagination="pagination"
      size="small"
      border
      max-height="380"
      @page-change="setPage"
    >
      <template #creator="{ row }">{{ formatCreator(row.creator) }}</template>
    </ReReadonlyTable>
  </div>
</template>
