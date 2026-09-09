import { hasAuth } from "@/router/utils";
import { h, reactive, shallowRef } from "vue";
import { useI18n } from "vue-i18n";
import { ElTag } from "element-plus";
import { importRecordApi } from "@/api/system/import";
import { statusTagProps } from "@/utils/dict";
import type { OperationProps, PageTableColumn } from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { addDialog } from "@/components/ReDialog";
import TaskLogDialog from "@/views/system/components/TaskLogDialog.vue";
import ArrowDown from "~icons/ri/arrow-down-line";
import FileList from "~icons/ri/file-list-3-line";

/** 字节数人类可读（与导出记录口径一致：1024 进制） */
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

/** 导入记录页签：权限码挂在下载中心菜单下（download/log:list:SystemImportRecord 等） */
export function useImportRecord() {
  const api = reactive(importRecordApi);
  // 页签无独立菜单，权限码以组件名 SystemImportRecord 显式判权
  const auth = reactive({
    list: hasAuth("list:SystemImportRecord"),
    destroy: hasAuth("destroy:SystemImportRecord"),
    batchDestroy: hasAuth("batchDestroy:SystemImportRecord"),
    download: hasAuth("download:SystemImportRecord"),
    log: hasAuth("log:SystemImportRecord")
  });
  const { t } = useI18n();

  /** 打开导入任务日志弹窗（复用任务执行日志的 WS 增量消费组件） */
  const openLog = (pk: string | number, name: string) => {
    addDialog({
      title: `${name} ${t("systemImportRecord.logTitle")}`,
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
        text: t("systemImportRecord.download"),
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
        text: t("systemImportRecord.log"),
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
          // 字典驱动（DictChoiceField）：颜色/文案管理员可在数据字典 import_status
          // 维护；字典未配置回退枚举时无 color，由 statusTagProps 走本地映射兜底
          column.cellRenderer = ({ row }) => {
            const statusValue = row.status?.value ?? row.status;
            return h(ElTag, statusTagProps(row.status), () =>
              row.status?.label ?? t(`systemImportRecord.status${statusValue}`)
            );
          };
          break;
        case "action":
          column.cellRenderer = ({ row }) =>
            h(
              ElTag,
              { type: row.action === "create" ? "success" : "primary" },
              () =>
                t(`systemImportRecord.action${row.action?.value ?? row.action}`)
            );
          break;
        case "report_filesize":
          column.cellRenderer = ({ row }) =>
            row.report_filesize === null || row.report_filesize === undefined
              ? h("span", "—")
              : h("span", formatBytes(row.report_filesize));
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
