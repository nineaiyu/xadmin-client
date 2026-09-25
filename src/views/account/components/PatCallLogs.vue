<script lang="ts" setup>
import { SUCCESS_CODE } from "@/api/types";
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { RecordType } from "plus-pro-components";
import type { BaseResult, ListResult } from "@/api/types";
import { personalAccessTokenApi } from "@/api/user/token";
import {
  ReReadonlyTable,
  type ReadonlyColumn
} from "@/components/ReReadonlyTable";

defineOptions({ name: "PatCallLogs" });

/** 调用记录弹窗内容：副作用自发起（内容组件范式，同 MaskPreview） */
const props = defineProps<{ pk: string | number }>();

type CallLog = RecordType & {
  module: string;
  path: string;
  method: string;
  status_code: number | null;
  exec_time: number | null;
  created_time: string;
};

type CallStats = {
  total: number;
  failed: number;
  window_days: number;
  last_used_time: string | null;
};

const { t } = useI18n();
const loading = ref(false);
const page = ref(1);
const total = ref(0);
const rows = ref<Array<CallLog>>([]);
const stats = ref<CallStats>({
  total: 0,
  failed: 0,
  window_days: 7,
  last_used_time: null
});

const fetchLogs = () => {
  loading.value = true;
  personalAccessTokenApi
    .logs(props.pk, { page: page.value, size: 10 })
    .then((res: ListResult) => {
      if (res.code === SUCCESS_CODE && res.data) {
        rows.value = res.data.results as Array<CallLog>;
        total.value = res.data.total ?? 0;
      }
    })
    .catch(() => {
      // 失败提示由 http 拦截器统一处理，这里兜住 reject 避免 unhandled rejection
      rows.value = [];
      total.value = 0;
    })
    .finally(() => {
      loading.value = false;
    });
};

const fetchStats = () => {
  personalAccessTokenApi
    .stats(props.pk)
    .then((res: BaseResult & { data?: CallStats }) => {
      if (res.code === SUCCESS_CODE && res.data) {
        stats.value = res.data;
      }
    })
    .catch(() => {
      // 统计属附加信息：失败保持默认值即可
    });
};

/** 调用明细列：状态与耗时需格式化，走具名插槽 */
const columns = computed<ReadonlyColumn[]>(() => [
  {
    prop: "module",
    label: t("logsOperation.module"),
    minWidth: 110,
    showOverflowTooltip: true
  },
  {
    prop: "path",
    label: t("logsOperation.path"),
    minWidth: 180,
    showOverflowTooltip: true
  },
  { prop: "method", label: t("logsOperation.method"), width: 80 },
  {
    label: t("logsOperation.status_code"),
    width: 90,
    slot: "status_code"
  },
  { label: t("logsOperation.exec_time"), width: 90, slot: "exec_time" },
  {
    prop: "created_time",
    label: t("accessToken.createdTime"),
    width: 170
  }
]);

const onPageChange = (value: number) => {
  page.value = value;
  fetchLogs();
};

onMounted(() => {
  fetchStats();
  fetchLogs();
});
</script>

<template>
  <div>
    <el-alert
      type="info"
      :closable="false"
      :title="t('accessToken.callLogsTip')"
      class="mb-3"
    />
    <el-descriptions :column="3" size="small" class="mb-3" border>
      <el-descriptions-item
        :label="t('accessToken.totalCalls', { n: stats.window_days })"
      >
        {{ stats.total }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('accessToken.failedCalls')">
        {{ stats.failed }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('accessToken.lastCall')">
        {{ stats.last_used_time ?? "—" }}
      </el-descriptions-item>
    </el-descriptions>
    <ReReadonlyTable
      :columns="columns"
      :rows="rows"
      :loading="loading"
      size="small"
      border
    >
      <template #status_code="{ row }">
        <el-tag
          :type="row.status_code === 1000 ? 'success' : 'danger'"
          size="small"
        >
          {{ row.status_code ?? "—" }}
        </el-tag>
      </template>
      <template #exec_time="{ row }">
        {{ row.exec_time != null ? `${row.exec_time.toFixed(2)}s` : "—" }}
      </template>
    </ReReadonlyTable>
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
