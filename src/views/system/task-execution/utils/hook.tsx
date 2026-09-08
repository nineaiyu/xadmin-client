import { getCurrentInstance, reactive, shallowRef, ref } from "vue";
import { useI18n } from "vue-i18n";
import { taskExecutionApi } from "@/api/system/task";
import { getDefaultAuths } from "@/router/utils";
import type { OperationProps, PageTableColumn } from "@/components/RePlusPage";
import type { TaskLogDialogInstance } from "../TaskLogDialog.vue";

type TagType = "primary" | "success" | "warning" | "info" | "danger";

const STATUS_TYPE: Record<string, TagType> = {
  SUCCESS: "success",
  FAILURE: "danger",
  RUNNING: "primary",
  PENDING: "info",
  REVOKED: "warning"
};

/** 执行历史页：状态标签 / 耗时列 / 日志按钮 */
export function useTaskExecution() {
  const { t } = useI18n();
  const api = reactive(taskExecutionApi);
  const auth = reactive({
    ...getDefaultAuths(getCurrentInstance(), ["log"])
  });
  const logDialogRef = ref<TaskLogDialogInstance | null>(null);

  const listColumnsFormat = (columns: PageTableColumn[]) => {
    const status = columns.find(column => column._column?.key === "status");
    if (status) {
      status.cellRenderer = ({ row }) => {
        // API 返回 LabeledChoiceField 形状 {value,label}，兼容旧的纯字符串状态
        const statusValue = row.status?.value ?? row.status;
        return (
          <el-tag type={STATUS_TYPE[statusValue] ?? "info"}>
            {t(`systemTaskExecution.status${statusValue}`)}
          </el-tag>
        );
      };
    }
    const timeCost = columns.find(
      column => column._column?.key === "time_cost"
    );
    if (timeCost) {
      timeCost.cellRenderer = ({ row }) =>
        row.time_cost === null || row.time_cost === undefined ? (
          <span>—</span>
        ) : (
          <span>{row.time_cost}s</span>
        );
    }
    return columns;
  };

  const operationButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("systemTaskExecution.log"),
        code: "log",
        props: { type: "primary", link: true },
        onClick: ({ row }) => {
          // 表格行动态边界：按 open 所需契约收窄
          logDialogRef.value?.open(
            row as { pk: string | number; name: string }
          );
        },
        show: auth.log
      }
    ]
  });

  return { api, auth, listColumnsFormat, operationButtonsProps, logDialogRef };
}
