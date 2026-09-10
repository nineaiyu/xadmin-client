<script lang="ts" setup>
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { RecordType } from "plus-pro-components";
import type { BaseResult, ListResult } from "@/api/types";
import { personalAccessTokenApi } from "@/api/user/token";

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
      if (res.code === 1000 && res.data) {
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
      if (res.code === 1000 && res.data) {
        stats.value = res.data;
      }
    })
    .catch(() => {
      // 统计属附加信息：失败保持默认值即可
    });
};

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
    <el-table v-loading="loading" :data="rows" size="small" border>
      <el-table-column
        prop="module"
        :label="t('logsOperation.module')"
        min-width="110"
        show-overflow-tooltip
      />
      <el-table-column
        prop="path"
        :label="t('logsOperation.path')"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column
        prop="method"
        :label="t('logsOperation.method')"
        width="80"
      />
      <el-table-column
        prop="status_code"
        :label="t('logsOperation.status_code')"
        width="80"
      >
        <template #default="{ row }">
          <el-tag
            :type="row.status_code === 1000 ? 'success' : 'danger'"
            size="small"
          >
            {{ row.status_code ?? "—" }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        prop="exec_time"
        :label="t('logsOperation.exec_time')"
        width="90"
      >
        <template #default="{ row }">
          {{ row.exec_time != null ? `${row.exec_time.toFixed(2)}s` : "—" }}
        </template>
      </el-table-column>
      <el-table-column
        prop="created_time"
        :label="t('accessToken.createdTime')"
        width="160"
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
