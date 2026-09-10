<script lang="ts" setup>
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { RecordType } from "plus-pro-components";
import { operationLogApi } from "@/api/system/logs/operation";

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

type LogRow = RecordType & {
  created_time: string;
  creator: string;
  method: string;
  path: string;
  status_code: number | null;
};

const { t } = useI18n();
const loading = ref(false);
const rows = ref<Array<LogRow>>([]);
const total = ref(0);
const page = ref(1);

const fetchLogs = () => {
  loading.value = true;
  operationLogApi
    .list({
      page: page.value,
      size: 10,
      // path_exact 精确匹配审批单的请求路径（避免前缀命中同模块其他接口）
      path_exact: props.path,
      ...(props.objectPk ? { object_pk: props.objectPk } : {}),
      ...(props.creatorPk ? { creator: props.creatorPk } : {})
    })
    .then(res => {
      if (res.code === 1000 && res.data) {
        rows.value = res.data.results as Array<LogRow>;
        total.value = res.data.total ?? 0;
      }
    })
    .catch(() => {
      // 失败提示由 http 拦截器统一处理，这里兜住 reject 并清空
      rows.value = [];
      total.value = 0;
    })
    .finally(() => {
      loading.value = false;
    });
};

const onPageChange = (value: number) => {
  page.value = value;
  fetchLogs();
};

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
    <el-table
      v-loading="loading"
      :data="rows"
      size="small"
      border
      max-height="380"
    >
      <el-table-column
        prop="created_time"
        :label="t('logsOperation.created_time')"
        width="160"
      />
      <el-table-column
        prop="creator"
        :label="t('logsOperation.creator')"
        width="120"
        show-overflow-tooltip
      />
      <el-table-column
        prop="method"
        :label="t('logsOperation.method')"
        width="90"
      />
      <el-table-column
        prop="path"
        :label="t('logsOperation.path')"
        min-width="200"
        show-overflow-tooltip
      />
      <el-table-column
        prop="status_code"
        :label="t('logsOperation.status_code')"
        width="90"
      />
    </el-table>
    <el-pagination
      class="mt-3"
      layout="prev, pager, next"
      :total="total"
      :page-size="10"
      :current-page="page"
      @current-change="onPageChange"
    />
  </div>
</template>
