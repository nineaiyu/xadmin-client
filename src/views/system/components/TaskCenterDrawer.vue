<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { hasAuth } from "@/router/utils";
import { closeAllDrawer } from "@/components/ReDrawer";
import { approvalApi } from "@/api/system/approval";
import { exportRecordApi } from "@/api/system/export";
import { importRecordApi } from "@/api/system/import";
import { taskExecutionApi } from "@/api/system/task";
import { statusTagProps, type StatusValue } from "@/utils/dict";
import type { ListResult } from "@/api/types";
import { openTaskLogDialog } from "./taskLogDialog";

/**
 * 任务中心聚合抽屉：审批待办 / 进行中任务 / 最近导出 / 最近导入四段。
 *
 * **不建聚合表、不双写**（四期结论）：四段各自读既有列表接口，一致性由各自的
 * 记录表保证；行内动作（下载 / 日志 / 跳转）复用既有链路，避免"两个入口两种口径"。
 */

defineOptions({ name: "TaskCenterDrawer" });

type Row = {
  pk: string;
  name: string;
  /** 状态原始值：字典驱动字段下发 `{value,label,color}` 对象，普通 Choice 下发标量 */
  status: unknown;
  created_time: string;
};

/** 每段最多展示条数（抽屉是"最近动态"视图，翻页交给各自的既有页面） */
const SECTION_SIZE = 5;

const IN_PROGRESS_STATUSES = ["PENDING", "RUNNING"];
/** 可下载文件记录的终态（其余状态没有产物） */
const DOWNLOADABLE_STATUSES = ["SUCCESS", "FAILURE"];

const PAGE_PATHS = {
  approval: "/system/approval/index",
  task: "/system/celery/logs/index",
  export: "/system/export/index"
};

const { t } = useI18n();
const router = useRouter();

const loading = ref(false);
const approvalRows = ref<Row[]>([]);
const taskRows = ref<Row[]>([]);
const exportRows = ref<Row[]>([]);
const importRows = ref<Row[]>([]);

const hasApproval = hasAuth("list:SystemApprovalRequest");
const hasTask = hasAuth("list:SystemTaskExecution");
const hasExport = hasAuth("list:SystemExportRecord");
const hasImport = hasAuth("list:SystemImportRecord");

/** 行结构由各记录模型决定：这里只取抽屉需要的四个键（缺失按空串/空值兜底） */
function toRows(res: { code: number; data?: unknown }): Row[] {
  const results = ((res.data as ListResult["data"] | undefined)?.results ??
    []) as Record<string, unknown>[];
  return results.map(item => ({
    pk: String(item.pk ?? ""),
    // 审批单用 title，导出/导入/任务执行用 name
    name: String(item.name ?? item.title ?? ""),
    status: item.status,
    created_time: String(item.created_time ?? "")
  }));
}

/**
 * 状态取值：字典驱动字段在列表里是 `{value,label,color}` 对象，
 * 直接 String() 会渲染成 `[object Object]`（也会让状态判断全部失配）。
 */
function statusValue(row: Row): string {
  const status = row.status;
  if (typeof status === "object" && status !== null) {
    return String((status as { value?: unknown }).value ?? "");
  }
  return String(status ?? "");
}

/** 状态显示文案：优先字典 label，避免把内部取值（如 PENDING）直接给用户看 */
function statusLabel(row: Row): string {
  const status = row.status;
  if (typeof status === "object" && status !== null) {
    const item = status as { label?: unknown; value?: unknown };
    return String(item.label ?? item.value ?? "");
  }
  return String(status ?? "");
}

async function loadSection(
  allowed: boolean,
  request: () => Promise<ListResult>,
  target: typeof approvalRows,
  filter?: (_row: Row) => boolean
) {
  if (!allowed) {
    target.value = [];
    return;
  }
  try {
    const res = await request();
    const rows = res.code === 1000 ? toRows(res) : [];
    target.value = (filter ? rows.filter(filter) : rows).slice(0, SECTION_SIZE);
  } catch {
    target.value = [];
  }
}

async function load() {
  loading.value = true;
  try {
    await Promise.all([
      loadSection(
        hasApproval,
        () =>
          approvalApi.list({ scope: "pending", page: 1, size: SECTION_SIZE }),
        approvalRows
      ),
      // 任务执行：只留进行中，终态交给执行历史页查
      loadSection(
        hasTask,
        () => taskExecutionApi.list({ page: 1, size: 50 }),
        taskRows,
        row => IN_PROGRESS_STATUSES.includes(statusValue(row))
      ),
      loadSection(
        hasExport,
        () => exportRecordApi.list({ page: 1, size: SECTION_SIZE }),
        exportRows
      ),
      loadSection(
        hasImport,
        () => importRecordApi.list({ page: 1, size: SECTION_SIZE }),
        importRows
      )
    ]);
  } finally {
    loading.value = false;
  }
}

const sections = computed(() => [
  {
    key: "approval",
    title: t("taskCenter.pendingApproval"),
    path: PAGE_PATHS.approval,
    rows: approvalRows.value
  },
  {
    key: "task",
    title: t("taskCenter.runningTasks"),
    path: PAGE_PATHS.task,
    rows: taskRows.value
  },
  {
    key: "export",
    title: t("taskCenter.recentExports"),
    path: PAGE_PATHS.export,
    rows: exportRows.value
  },
  {
    key: "import",
    title: t("taskCenter.recentImports"),
    path: PAGE_PATHS.export,
    rows: importRows.value
  }
]);

/** 跳转既有页面前先关抽屉：避免"跳走了抽屉还浮在上面" */
const goPage = (path: string) => {
  closeAllDrawer();
  void router.push(path);
};

/** 下载：导出记录下载产物，导入记录下载失败行错误报告，均走鉴权接口 */
const download = (key: string, row: Row) => {
  if (!DOWNLOADABLE_STATUSES.includes(statusValue(row))) return;
  if (key === "export") {
    void exportRecordApi.download(row.pk);
  } else if (key === "import") {
    void importRecordApi.download(row.pk);
  }
};

const canDownload = (key: string, row: Row) =>
  (key === "export" || key === "import") &&
  DOWNLOADABLE_STATUSES.includes(statusValue(row));

const openLog = (row: Row) => {
  openTaskLogDialog(row.pk, `${row.name} ${t("taskCenter.logTitle")}`);
};

onMounted(load);

defineExpose({ load });
</script>

<template>
  <div v-loading="loading" class="task-center">
    <el-empty
      v-if="sections.every(item => item.rows.length === 0)"
      :description="t('taskCenter.empty')"
      :image-size="70"
    />
    <div v-for="item in sections" :key="item.key" class="mb-4">
      <div class="mb-2 flex-bc">
        <span class="text-sm font-medium">
          {{ item.title }}
          <el-tag v-if="item.rows.length" size="small" type="info">
            {{ item.rows.length }}
          </el-tag>
        </span>
        <el-link type="primary" underline="never" @click="goPage(item.path)">
          {{ t("taskCenter.viewAll") }}
        </el-link>
      </div>
      <el-empty
        v-if="item.rows.length === 0"
        :description="t('taskCenter.noData')"
        :image-size="50"
      />
      <div v-else class="record-list">
        <div v-for="row in item.rows" :key="row.pk" class="record-row">
          <div class="min-w-0 flex-1">
            <div class="truncate">{{ row.name || row.pk }}</div>
            <div class="mt-1 flex items-center gap-2 text-xs text-gray-500">
              <el-tag
                v-bind="statusTagProps(row.status as StatusValue)"
                size="small"
              >
                {{ statusLabel(row) }}
              </el-tag>
              <span>{{ row.created_time }}</span>
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <el-button
              v-if="canDownload(item.key, row)"
              link
              type="primary"
              @click="download(item.key, row)"
            >
              {{ t("taskCenter.download") }}
            </el-button>
            <el-button
              v-if="item.key !== 'approval'"
              link
              type="primary"
              @click="openLog(row)"
            >
              {{ t("taskCenter.log") }}
            </el-button>
            <el-button
              v-else
              link
              type="primary"
              @click="goPage(PAGE_PATHS.approval)"
            >
              {{ t("taskCenter.handle") }}
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.task-center {
  padding: 4px 2px;

  .record-list {
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
  }

  .record-row {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 8px 10px;

    & + .record-row {
      border-top: 1px solid var(--el-border-color-lighter);
    }
  }
}
</style>
