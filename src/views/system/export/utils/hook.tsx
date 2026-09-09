import { getCurrentInstance, h, reactive, shallowRef } from "vue";
import { useI18n } from "vue-i18n";
import { ElTag } from "element-plus";
import { exportRecordApi } from "@/api/system/export";
import { getDefaultAuths } from "@/router/utils";
import type { OperationProps, PageTableColumn } from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { addDialog } from "@/components/ReDialog";
import TaskLogDialog from "@/views/system/components/TaskLogDialog.vue";
import ArrowDown from "~icons/ri/arrow-down-line";
import FileList from "~icons/ri/file-list-3-line";

type TagType = "primary" | "success" | "warning" | "info" | "danger";

const STATUS_TYPE: Record<string, TagType> = {
  SUCCESS: "success",
  FAILURE: "danger",
  RUNNING: "primary",
  PENDING: "info"
};

/** 字节数人类可读（与上传文件大小展示口径一致：1024 进制） */
function formatBytes(size: number): string {
  if (!size) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function useExportRecord() {
  const api = reactive(exportRecordApi);
  const auth = reactive({
    ...getDefaultAuths(getCurrentInstance(), ["download", "log"])
  });
  const { t } = useI18n();

  /** 打开导出任务日志弹窗（复用任务执行日志的 WS 增量消费组件） */
  const openLog = (pk: string | number, name: string) => {
    addDialog({
      title: `${name} ${t("systemExportRecord.logTitle")}`,
      width: "860px",
      destroyOnClose: true,
      closeOnClickModal: false,
      hideFooter: true,
      props: { pk },
      contentRenderer: () => h(TaskLogDialog)
    });
  };

  const operationButtonsProps = shallowRef<OperationProps>({
    showNumber: 4,
    buttons: [
      {
        text: t("systemExportRecord.download"),
        code: "download",
        props: {
          type: "primary",
          icon: useRenderIcon(ArrowDown),
          link: true
        },
        onClick: ({ row }) => {
          api.download(row?.pk ?? row?.id);
        },
        show: auth.download && 4
      },
      {
        text: t("systemExportRecord.log"),
        code: "log",
        props: {
          type: "info",
          icon: useRenderIcon(FileList),
          link: true
        },
        onClick: ({ row }) => {
          openLog(row?.pk ?? row?.id, row.name);
        },
        show: auth.log && 5
      }
    ]
  });

  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "status":
          // 关联/枚举字段返回 {value,label} 形状，兼容旧的纯字符串状态
          column.cellRenderer = ({ row }) => {
            const statusValue = row.status?.value ?? row.status;
            return h(ElTag, { type: STATUS_TYPE[statusValue] ?? "info" }, () =>
              t(`systemExportRecord.status${statusValue}`)
            );
          };
          break;
        case "filesize":
          column.cellRenderer = ({ row }) =>
            row.filesize === null || row.filesize === undefined
              ? h("span", "—")
              : h("span", formatBytes(row.filesize));
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
