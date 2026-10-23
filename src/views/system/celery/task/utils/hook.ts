import { ref } from "vue";
import { periodicTaskApi } from "@/api/task/task";
import {
  defineListPage,
  formatPageColumns,
  renderSwitch,
  usePublicHooks,
  type PageTableColumn
} from "@/components/RePlusPage";
import { useTaskFormColumns } from "./useTaskFormColumns";
import { useTaskRowActions } from "./useTaskRowActions";
import { useTaskToolbar } from "./useTaskToolbar";

export function useTask() {
  const switchLoadMap = ref({});
  const { switchStyle } = usePublicHooks();

  const page = defineListPage({
    api: periodicTaskApi,
    localeName: "systemTask",
    extraAuth: [
      "run",
      "log",
      "batchRun",
      "batchEnable",
      "batchDisable",
      "clone",
      "enable"
    ],
    columns: ({ t, api, auth, tableRef, columns }) =>
      formatPageColumns(columns, {
        /**
         * 启用状态列：覆盖框架通用布尔开关（partialUpdate），统一走 enable 动作，
         * 保证启停只由 enable:SystemTask 授权，并触发 django_celery_beat 的保存信号。
         */
        enabled: (column: PageTableColumn) => {
          column["cellRenderer"] = renderSwitch({
            t,
            updateApi: (pk, data) =>
              api.enable(
                pk,
                Boolean((data as { enabled?: boolean } | undefined)?.enabled)
              ),
            switchLoadMap,
            switchStyle,
            field: "enabled",
            disabled: () => !auth.enable,
            success() {
              tableRef.value?.handleGetData?.();
            },
            failed() {
              tableRef.value?.handleGetData?.();
            }
          });
        }
      }),
    buttons: ({ t, api, auth, tableRef }) => ({
      // 行内动作（立即执行/实时日志/克隆）与执行日志弹窗编排
      ...useTaskRowActions({ t, api, auth, tableRef }),
      // 工具栏批量动作（批量执行/启停）
      ...useTaskToolbar({ t, api, auth, tableRef })
    })
  });

  // 新增/编辑表单：任务路径下拉（已注册任务）装配
  const { baseColumnsFormat } = useTaskFormColumns({ api: page.api });

  return { ...page, baseColumnsFormat };
}
