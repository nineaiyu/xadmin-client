import { getCurrentInstance, h, reactive, shallowRef } from "vue";
import { useI18n } from "vue-i18n";
import { taskExecutionApi } from "@/api/system/task";
import { getDefaultAuths } from "@/router/utils";
import { statusTagProps } from "@/utils/dict";
import type { OperationProps, PageTableColumn } from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { addDialog } from "@/components/ReDialog";
import TaskLogDialog from "@/views/system/components/TaskLogDialog.vue";
import { ElTag } from "element-plus";
import FileList from "~icons/ri/file-list-3-line";

export function useTaskExecution() {
  // 权限判断，用于判断是否有该权限
  const api = reactive(taskExecutionApi);
  const auth = reactive({
    ...getDefaultAuths(getCurrentInstance(), ["log"])
  });
  const { t } = useI18n();

  /**
   * 打开某条执行记录的实时日志弹窗（WebSocket 增量推送）
   */
  const openLog = (pk: string | number, name: string) => {
    addDialog({
      title: `${name} ${t("systemTask.logTitle")}`,
      width: "860px",
      destroyOnClose: true,
      closeOnClickModal: false,
      hideFooter: true,
      props: { pk },
      contentRenderer: () => h(TaskLogDialog)
    });
  };

  /**
   * 新增一个"查看日志"的行内操作按钮
   */
  const operationButtonsProps = shallowRef<OperationProps>({
    showNumber: 4,
    buttons: [
      {
        text: t("systemTaskExecution.log"),
        code: "log",
        props: {
          type: "primary",
          icon: useRenderIcon(FileList),
          link: true
        },
        onClick: ({ row }) => {
          // 表格行动态边界：按 open 所需契约收窄
          openLog(row?.pk ?? row?.id, row.name);
        },
        show: auth.log && 4
      }
    ]
  });

  /**
   * 表格列操作
   */
  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "status":
          // 字典驱动（DictChoiceField）：颜色/文案管理员可在数据字典 task_status
          // 维护；字典未配置回退枚举时无 color，由 statusTagProps 走本地映射兜底
          column.cellRenderer = ({ row }) => {
            const statusValue = row.status?.value ?? row.status;
            return h(
              ElTag,
              statusTagProps(row.status),
              () =>
                row.status?.label ??
                t(`systemTaskExecution.status${statusValue}`)
            );
          };
          break;
        case "time_cost":
          column.cellRenderer = ({ row }) =>
            row.time_cost === null || row.time_cost === undefined
              ? h("span", "—")
              : h("span", `${row.time_cost}s`);
          break;
      }
    });
    return columns;
  };

  return {
    api,
    auth,
    listColumnsFormat,
    operationButtonsProps
  };
}
