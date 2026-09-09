<script lang="ts" setup>
import { onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { PaginationProps } from "@pureadmin/table";
import type { ListResult } from "@/api/types";
import { operationLogApi } from "@/api/system/logs/operation";

defineOptions({ name: "ChangeHistoryDialog" });

interface Props {
  /** 当前页面 API 前缀（如 /api/system/user），用于 path 前缀过滤 */
  baseApi: string;
  /** 行主键：变更历史按 object_pk（detail 路由提取）回溯 */
  pk: string | number;
}

const props = defineProps<Props>();
const { t } = useI18n();

interface HistoryRow {
  pk: string;
  method: string;
  status_code: number | null;
  creator: { username?: string } | null;
  changes: Record<string, { old: string | null; new: string | null }> | null;
  created_time: string;
}

const loading = ref(false);
const dataList = ref<HistoryRow[]>([]);
const pagination = reactive<PaginationProps>({
  total: 0,
  pageSize: 10,
  currentPage: 1,
  background: true,
  layout: "prev, pager, next"
});

/**
 * 行级变更历史过滤口径：
 * - object_pk：中间件从 detail 路由 URL kwargs 提取的对象主键，精确匹配；
 * - path 前缀（icontains）缩小到本资源，防数值主键跨模块串扰。
 * 命中 idx_oplog_module_objectpk 索引。
 */
const METHOD_TYPE: Record<string, "success" | "primary" | "danger"> = {
  POST: "success",
  PATCH: "primary",
  PUT: "primary",
  DELETE: "danger"
};

const fetchHistory = () => {
  loading.value = true;
  operationLogApi
    .list({
      object_pk: String(props.pk),
      path: `${props.baseApi}/`,
      page: pagination.currentPage,
      size: pagination.pageSize
    })
    .then((res: ListResult) => {
      // 操作日志接口返回宽表行（RecordType[]），这里只消费变更历史所需字段
      dataList.value = res.data.results as unknown as HistoryRow[];
      pagination.total = res.data.total ?? dataList.value.length;
    })
    .finally(() => {
      loading.value = false;
    });
};

/** changes 落库为 TextField，序列化输出是 JSON 字符串；兼容已是对象的旧口径 */
const parseChanges = (
  changes: HistoryRow["changes"]
): Record<string, { old: string | null; new: string | null }> => {
  if (!changes) return {};
  if (typeof changes === "string") {
    try {
      return JSON.parse(changes);
    } catch {
      return {};
    }
  }
  return changes;
};

const diffEntries = (changes: HistoryRow["changes"]) =>
  Object.entries(parseChanges(changes)).map(([field, value]) => ({
    field,
    old: value?.old,
    new: value?.new
  }));

onMounted(fetchHistory);
</script>

<template>
  <div class="p-2">
    <el-table v-loading="loading" :data="dataList" size="small" border>
      <el-table-column
        prop="created_time"
        :label="t('changeHistory.time')"
        width="170"
      />
      <el-table-column :label="t('changeHistory.operator')" width="120">
        <template #default="{ row }">
          {{ row.creator?.username ?? row.creator ?? "—" }}
        </template>
      </el-table-column>
      <el-table-column :label="t('changeHistory.method')" width="90">
        <template #default="{ row }">
          <el-tag :type="METHOD_TYPE[row.method] ?? 'info'" size="small">
            {{ row.method }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        prop="status_code"
        :label="t('changeHistory.statusCode')"
        width="100"
      >
        <template #default="{ row }">
          {{ row.status_code ?? "—" }}
        </template>
      </el-table-column>
      <el-table-column :label="t('changeHistory.changes')">
        <template #default="{ row }">
          <span v-if="!row.changes" class="text-gray-400">—</span>
          <div v-else class="flex flex-col gap-1">
            <div
              v-for="entry in diffEntries(row.changes)"
              :key="entry.field"
              class="text-xs/5"
            >
              <span class="font-medium">{{ entry.field }}</span>
              <span class="text-red-500 line-through ml-1">
                {{ entry.old ?? "null" }}
              </span>
              <el-icon class="mx-0.5 align-middle">
                <IconifyIconOffline icon="ep:arrow-right" />
              </el-icon>
              <span class="text-green-600">{{ entry.new ?? "null" }}</span>
            </div>
          </div>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination
      v-model:current-page="pagination.currentPage"
      v-model:page-size="pagination.pageSize"
      class="float-right mt-3"
      :total="pagination.total"
      :layout="pagination.layout"
      :background="pagination.background"
      @current-change="fetchHistory"
    />
  </div>
</template>
