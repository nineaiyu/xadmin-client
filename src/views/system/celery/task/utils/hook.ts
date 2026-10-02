import { getCurrentInstance, reactive, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { periodicTaskApi } from "@/api/system/task";
import { getDefaultAuths } from "@/router/utils";
import { useTaskFormColumns } from "./useTaskFormColumns";
import { useTaskRowActions } from "./useTaskRowActions";
import { useTaskToolbar } from "./useTaskToolbar";

export function useTask(tableRef: Ref) {
  // 权限判断，用于判断是否有该权限
  const api = reactive(periodicTaskApi);
  const auth = reactive({
    ...getDefaultAuths(getCurrentInstance(), [
      "run",
      "log",
      "batchRun",
      "batchEnable",
      "batchDisable",
      "clone"
    ])
  });
  const { t } = useI18n();

  // 行内动作（立即执行/实时日志/克隆）与执行日志弹窗编排
  const { operationButtonsProps } = useTaskRowActions({
    t,
    api,
    auth,
    tableRef
  });

  // 工具栏批量动作（批量执行/启停/更新）
  const { tableBarButtonsProps } = useTaskToolbar({
    t,
    api,
    auth,
    tableRef
  });

  // 新增/编辑表单：任务路径下拉（已注册任务）装配
  const { baseColumnsFormat } = useTaskFormColumns({ api });

  return {
    api,
    auth,
    baseColumnsFormat,
    tableBarButtonsProps,
    operationButtonsProps
  };
}
