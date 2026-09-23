<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessageBox } from "element-plus";
import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import { hasAuth } from "@/router/utils";
import { statusTagProps } from "@/utils/dict";
import { openTaskLogDialog } from "../components/taskLogDialog";
import {
  taskCenterApi,
  type TaskCenterKind,
  type TaskCenterRow
} from "@/api/system/task";

/**
 * 任务中心（P-2）：三类记录（执行历史 / 导出 / 导入）统一列表 + 取消 / 重跑 / 日志 / 下载。
 *
 * 接口只读聚合，不建新表；数据域与下载中心一致（超管全量，其余仅本人记录）。
 * 取消为协作式语义（PENDING 立即终态，RUNNING 在安全点收敛），文案需如实说明。
 */
defineOptions({
  name: "SystemTaskCenter" // 必须定义，用于菜单自动匹配组件
});

const { t } = useI18n();

const loading = ref(false);
const rows = ref<TaskCenterRow[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(15);
const filters = ref({
  type: "" as "" | TaskCenterKind,
  status: "",
  keyword: ""
});

const canCancel = hasAuth("cancel:SystemTaskCenter");
const canRerun = hasAuth("rerun:SystemTaskCenter");

const TYPE_OPTIONS: { value: TaskCenterKind; labelKey: string }[] = [
  { value: "task", labelKey: "taskCenter.typeTask" },
  { value: "export", labelKey: "taskCenter.typeExport" },
  { value: "import", labelKey: "taskCenter.typeImport" }
];

const STATUS_OPTIONS = [
  { value: "PENDING", labelKey: "taskCenter.statusPending" },
  { value: "RUNNING", labelKey: "taskCenter.statusRunning" },
  { value: "SUCCESS", labelKey: "taskCenter.statusSuccess" },
  { value: "FAILURE", labelKey: "taskCenter.statusFailure" },
  { value: "REVOKED", labelKey: "taskCenter.statusRevoked" }
];

const statusTagType: Record<string, "success" | "warning" | "danger" | "info"> =
  {
    PENDING: "info",
    RUNNING: "warning",
    SUCCESS: "success",
    FAILURE: "danger",
    REVOKED: "info"
  };

const typeTagType: Record<string, "primary" | "success" | "warning"> = {
  task: "primary",
  export: "success",
  import: "warning"
};

const load = async () => {
  loading.value = true;
  try {
    const res = await taskCenterApi
      .getUnified({
        type: filters.value.type || undefined,
        status: filters.value.status || undefined,
        keyword: filters.value.keyword || undefined,
        page: page.value,
        size: size.value
      })
      .catch(error => ({
        code: -1,
        detail: String((error as { detail?: string })?.detail ?? error),
        data: { results: [], total: 0 }
      }));
    if (res.code === SUCCESS_CODE) {
      const data = (res.data ?? {}) as {
        results?: TaskCenterRow[];
        total?: number;
      };
      rows.value = data.results ?? [];
      total.value = data.total ?? 0;
    } else if (res.detail) {
      message(String(res.detail), { type: "warning" });
    }
  } finally {
    loading.value = false;
  }
};

const onSearch = () => {
  page.value = 1;
  load();
};

const onReset = () => {
  filters.value = { type: "", status: "", keyword: "" };
  onSearch();
};

const cancel = async (row: TaskCenterRow) => {
  const ok = await ElMessageBox.confirm(
    t("taskCenter.cancelConfirm"),
    t("taskCenter.cancelTitle"),
    {
      type: "warning",
      confirmButtonText: t("buttons.sure"),
      cancelButtonText: t("buttons.cancel")
    }
  )
    .then(() => true)
    .catch(() => false);
  if (!ok) return;
  const res = await taskCenterApi.cancel(row.type, row.pk).catch(error => ({
    code: -1,
    detail: String((error as { detail?: string })?.detail ?? error)
  }));
  if (res.code === SUCCESS_CODE) {
    message(String(res.detail ?? t("taskCenter.cancelDone")), {
      type: "success"
    });
    load();
  } else if (res.detail) {
    message(String(res.detail), { type: "warning" });
  }
};

const rerun = async (row: TaskCenterRow) => {
  const res = await taskCenterApi.rerun(row.type, row.pk).catch(error => ({
    code: -1,
    detail: String((error as { detail?: string })?.detail ?? error)
  }));
  if (res.code === SUCCESS_CODE) {
    message(String(res.detail ?? t("taskCenter.rerunDone")), {
      type: "success"
    });
    load();
  } else if (res.detail) {
    message(String(res.detail), { type: "warning" });
  }
};

const openLog = (row: TaskCenterRow) => {
  if (row.type === "export") {
    openTaskLogDialog(row.pk, `${row.name} ${t("taskCenter.logTitle")}`);
    return;
  }
  if (row.type === "import") {
    openTaskLogDialog(row.pk, `${row.name} ${t("taskCenter.logTitle")}`);
    return;
  }
  openTaskLogDialog(row.pk, `${row.name} ${t("taskCenter.logTitle")}`);
};

/** 产物下载：导出/导入记录各自端点（与下载中心同一链路） */
const downloadUrl = (row: TaskCenterRow) =>
  row.type === "export"
    ? `/api/system/exports/${row.pk}/download`
    : `/api/system/imports/${row.pk}/download`;

const progressOf = (row: TaskCenterRow) =>
  row.progress === null || row.progress === undefined ? null : row.progress;

const progressStatus = (row: TaskCenterRow) =>
  row.status === "FAILURE" || row.status === "REVOKED"
    ? "exception"
    : row.status === "SUCCESS"
      ? "success"
      : undefined;

const rowsLabel = computed(() => t("taskCenter.total", { total: total.value }));

/** el-table 插槽行类型为 DefaultRow：统一归一为任务中心行类型（避免模板内散落断言） */
const asRow = (row: unknown) => row as TaskCenterRow;

onMounted(load);
</script>

<template>
  <div class="main">
    <el-card shadow="never" class="mb-3">
      <div class="flex flex-wrap items-center gap-3">
        <el-select
          v-model="filters.type"
          clearable
          :placeholder="t('taskCenter.type')"
          style="width: 150px"
          data-testid="task-center-type"
        >
          <el-option
            v-for="item in TYPE_OPTIONS"
            :key="item.value"
            :label="t(item.labelKey)"
            :value="item.value"
          />
        </el-select>
        <el-select
          v-model="filters.status"
          clearable
          :placeholder="t('taskCenter.status')"
          style="width: 150px"
          data-testid="task-center-status"
        >
          <el-option
            v-for="item in STATUS_OPTIONS"
            :key="item.value"
            :label="t(item.labelKey)"
            :value="item.value"
          />
        </el-select>
        <el-input
          v-model="filters.keyword"
          clearable
          :placeholder="t('taskCenter.keyword')"
          style="width: 200px"
          data-testid="task-center-keyword"
          @keyup.enter="onSearch"
        />
        <el-button type="primary" @click="onSearch">
          {{ t("buttons.search") }}
        </el-button>
        <el-button @click="onReset">{{ t("buttons.reset") }}</el-button>
        <span class="text-sm opacity-70">{{ rowsLabel }}</span>
      </div>
    </el-card>

    <el-card shadow="never">
      <el-table
        v-loading="loading"
        :data="rows"
        row-key="pk"
        data-testid="task-center-table"
      >
        <el-table-column :label="t('taskCenter.colType')" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="typeTagType[row.type]">
              {{ t(`taskCenter.type_${row.type}`) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="name"
          :label="t('taskCenter.colName')"
          min-width="220"
          show-overflow-tooltip
        />
        <el-table-column
          prop="module"
          :label="t('taskCenter.colModule')"
          min-width="140"
          show-overflow-tooltip
        />
        <el-table-column :label="t('taskCenter.colStatus')" width="130">
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="statusTagProps(row.status, statusTagType).type"
            >
              {{ t(`taskCenter.status_${row.status}`) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('taskCenter.colProgress')" width="200">
          <template #default="{ row }">
            <el-progress
              v-if="progressOf(asRow(row)) !== null"
              :percentage="progressOf(asRow(row)) as number"
              :status="progressStatus(asRow(row))"
            />
            <span v-else>-</span>
            <!-- P-2 统一进度助手：阶段描述（运行中显示，如「统计行数 / 渲染内容」） -->
            <div
              v-if="asRow(row).stage"
              class="text-xs text-(--el-text-color-secondary)"
            >
              {{ asRow(row).stage }}
            </div>
          </template>
        </el-table-column>
        <el-table-column
          prop="creator"
          :label="t('taskCenter.colCreator')"
          width="120"
        />
        <el-table-column
          prop="created_time"
          :label="t('taskCenter.colCreated')"
          width="170"
          show-overflow-tooltip
        />
        <el-table-column
          prop="error"
          :label="t('taskCenter.colError')"
          min-width="180"
          show-overflow-tooltip
        />
        <el-table-column
          :label="t('taskCenter.colActions')"
          width="230"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button
              v-if="canCancel && row.can_cancel"
              type="warning"
              link
              @click="cancel(asRow(row))"
            >
              {{ t("taskCenter.cancel") }}
            </el-button>
            <el-button
              v-if="canRerun && row.can_rerun"
              type="primary"
              link
              @click="rerun(asRow(row))"
            >
              {{ t("taskCenter.rerun") }}
            </el-button>
            <el-button type="info" link @click="openLog(asRow(row))">
              {{ t("taskCenter.log") }}
            </el-button>
            <el-link
              v-if="row.has_file"
              type="primary"
              :href="downloadUrl(asRow(row))"
              target="_blank"
              class="ml-2"
            >
              {{ t("taskCenter.download") }}
            </el-link>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="size"
        class="mt-3 justify-end"
        layout="total, sizes, prev, pager, next"
        :total="total"
        :page-sizes="[15, 30, 50]"
        @current-change="load"
        @size-change="onSearch"
      />
    </el-card>
  </div>
</template>
