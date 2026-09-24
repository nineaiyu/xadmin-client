import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { SUCCESS_CODE } from "@/api/types";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { openTaskLogDialog } from "@/views/system/components/taskLogDialog";
import {
  taskCenterApi,
  taskExecutionApi,
  type TaskCenterKind,
  type TaskCenterRow
} from "@/api/system/task";
import { asRow, deletablePks } from "./columns";

/**
 * 任务中心页面逻辑：三类记录（执行历史 / 导出 / 导入）统一列表 + 取消 / 重跑 / 日志 / 下载 / 清理。
 *
 * 接口只读聚合，不建新表；数据域与下载中心一致（超管全量，其余仅本人记录）。
 * 执行历史的清理复用任务执行端点（权限点 destroy/batchDestroy:SystemTaskExecution），
 * 导出/导入记录的删除仍在下载中心（can_delete=false）。
 */
export function useTaskCenter() {
  const { t } = useI18n();

  const loading = ref(false);
  const rows = ref<TaskCenterRow[]>([]);
  const total = ref(0);
  const page = ref(1);
  const size = ref(15);
  const filters = ref({
    type: "" as "" | TaskCenterKind,
    status: "",
    keyword: "",
    creator: "",
    range: [] as string[]
  });
  const selection = ref<TaskCenterRow[]>([]);

  const canCancel = hasAuth("cancel:SystemTaskCenter");
  const canRerun = hasAuth("rerun:SystemTaskCenter");
  const canDelete = hasAuth("destroy:SystemTaskExecution");
  const canBatchDelete = hasAuth("batchDestroy:SystemTaskExecution");

  const selectedCount = computed(() => selection.value.length);
  const selectedDeletableCount = computed(
    () => deletablePks(selection.value).length
  );

  /** 统一异常归一：接口层错误也落回业务码分支（避免提示丢失） */
  const normalize = (error: unknown) => ({
    code: -1,
    detail: String((error as { detail?: string })?.detail ?? error)
  });

  const load = async () => {
    loading.value = true;
    try {
      const [start, end] = filters.value.range ?? [];
      const res = await taskCenterApi
        .getUnified({
          type: filters.value.type || undefined,
          status: filters.value.status || undefined,
          keyword: filters.value.keyword || undefined,
          creator: filters.value.creator || undefined,
          created_time_after: start || undefined,
          created_time_before: end || undefined,
          page: page.value,
          size: size.value
        })
        .catch(error => ({
          ...normalize(error),
          data: { results: [] as TaskCenterRow[], total: 0 }
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
    filters.value = {
      type: "",
      status: "",
      keyword: "",
      creator: "",
      range: []
    };
    onSearch();
  };

  const onSelectionChange = (value: unknown[]) => {
    // el-table 插槽/事件的行类型为 DefaultRow：统一归一后再参与清理判定
    selection.value = value.map(asRow);
  };

  const cancel = async (row: TaskCenterRow) => {
    const res = await taskCenterApi.cancel(row.type, row.pk).catch(normalize);
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
    const res = await taskCenterApi.rerun(row.type, row.pk).catch(normalize);
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
    openTaskLogDialog(row.pk, `${row.name} ${t("taskCenter.logTitle")}`);
  };

  /** 删除单条执行历史（产物记录的清理在下载中心） */
  const remove = async (row: TaskCenterRow) => {
    if (!row.can_delete) {
      message(t("taskCenter.deleteProductHint"), { type: "warning" });
      return;
    }
    const res = await taskExecutionApi.destroy(row.pk).catch(normalize);
    if (res.code === SUCCESS_CODE) {
      message(t("taskCenter.deleteDone"), { type: "success" });
      selection.value = selection.value.filter(item => item.pk !== row.pk);
      load();
    } else if (res.detail) {
      message(String(res.detail), { type: "warning" });
    }
  };

  /** 批量删除执行历史（选中的产物记录自动跳过） */
  const batchRemove = async () => {
    const pks = deletablePks(selection.value);
    if (!pks.length) {
      message(t("taskCenter.batchDeleteEmpty"), { type: "warning" });
      return;
    }
    const res = await taskExecutionApi.batchDestroy(pks).catch(normalize);
    if (res.code === SUCCESS_CODE) {
      message(t("taskCenter.deleteDone"), { type: "success" });
      selection.value = [];
      load();
    } else if (res.detail) {
      message(String(res.detail), { type: "warning" });
    }
  };

  /** 产物下载：导出/导入记录各自端点（与下载中心同一链路） */
  const downloadUrl = (row: TaskCenterRow) =>
    row.type === "export"
      ? `/api/system/exports/${row.pk}/download`
      : `/api/system/imports/${row.pk}/download`;

  onMounted(load);

  return {
    t,
    loading,
    rows,
    total,
    page,
    size,
    filters,
    selection,
    canCancel,
    canRerun,
    canDelete,
    canBatchDelete,
    selectedCount,
    selectedDeletableCount,
    load,
    onSearch,
    onReset,
    onSelectionChange,
    cancel,
    rerun,
    openLog,
    remove,
    batchRemove,
    downloadUrl
  };
}
