import { h, reactive, shallowRef } from "vue";
import { useI18n } from "vue-i18n";
import { ElProgress, ElTag } from "element-plus";
import { getDefaultAuths } from "@/router/utils";
import { statusTagProps, type StatusTagType } from "@/utils/dict";
import type { OperationProps, PageTableColumn } from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { addDialog } from "@/components/ReDialog";
import TaskLogDialog from "@/views/system/components/TaskLogDialog.vue";
import ArrowDown from "~icons/ri/arrow-down-line";
import FileList from "~icons/ri/file-list-3-line";

/** 导入动作的 tag 类型兜底映射（字典项未配置 color 时使用） */
const ACTION_TAG_TYPE: Record<string, StatusTagType> = {
  create: "success",
  update: "primary"
};

/** 字节数人类可读（导入/导出记录同一口径：1024 进制） */
export function formatBytes(size: number): string {
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

/** 记录 API 最小契约：exportRecordApi / importRecordApi 均实现 */
interface RecordCenterApi {
  download: (pk: string | number) => unknown;
}

interface RecordCenterOptions {
  /** i18n 前缀：systemExportRecord / systemImportRecord */
  localePrefix: string;
  /** 权限码组件名（页签无独立菜单，权限码挂下载中心菜单的组件名下） */
  componentName: string;
  /** 记录 API：exportRecordApi / importRecordApi */
  api: RecordCenterApi;
  /** 文件大小字段键：导出记录 filesize / 导入记录 report_filesize */
  sizeKey: "filesize" | "report_filesize";
}

/**
 * 下载中心记录页签公共装配：状态/进度列渲染、下载与日志操作按钮。
 * 导出记录与导入记录的列表行为完全同构，唯一差异是 i18n 前缀、
 * 权限组件名、API 实例与文件大小字段——统一收口防止两侧样式漂移。
 */
export function useRecordCenter(options: RecordCenterOptions) {
  const { localePrefix, componentName, sizeKey } = options;
  const api = reactive(options.api);
  const auth = reactive(getDefaultAuths(componentName, ["download", "log"]));
  const { t } = useI18n();

  /** 打开任务日志弹窗（复用任务执行日志的 WS 增量消费组件） */
  const openLog = (pk: string | number, name: string) => {
    addDialog({
      title: `${name} ${t(`${localePrefix}.logTitle`)}`,
      width: "860px",
      destroyOnClose: true,
      closeOnClickModal: false,
      hideFooter: true,
      props: { pk },
      contentRenderer: () => h(TaskLogDialog)
    });
  };

  /** 进度列：RUNNING 进度条，SUCCESS 100%，其余显示 — */
  const renderProgress = row => {
    const statusValue = row.status?.value ?? row.status;
    if (statusValue === "RUNNING") {
      return h(ElProgress, {
        percentage: row.progress ?? 0,
        strokeWidth: 8,
        class: "w-full!"
      });
    }
    return h("span", statusValue === "SUCCESS" ? "100%" : "—");
  };

  const operationButtonsProps = shallowRef<OperationProps>({
    showNumber: 4,
    buttons: [
      {
        text: t(`${localePrefix}.download`),
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
        text: t(`${localePrefix}.log`),
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
          // 字典驱动（DictChoiceField）：颜色/文案管理员可在数据字典维护；
          // 字典未配置回退枚举时无 color，由 statusTagProps 走本地映射兜底
          column.cellRenderer = ({ row }) => {
            const statusValue = row.status?.value ?? row.status;
            return h(
              ElTag,
              statusTagProps(row.status),
              () =>
                row.status?.label ?? t(`${localePrefix}.status${statusValue}`)
            );
          };
          break;
        case "action":
          // 导入动作（import_action 字典驱动）：color 优先彩色 tag，
          // 无色回退 ACTION_TAG_TYPE；label 字典优先回退页面 i18n
          column.cellRenderer = ({ row }) => {
            const action = row.action;
            const actionValue = action?.value ?? action;
            const actionProps = action?.color
              ? { color: action.color }
              : { type: ACTION_TAG_TYPE[String(actionValue)] ?? "info" };
            return h(
              ElTag,
              actionProps,
              () => action?.label ?? t(`${localePrefix}.action${actionValue}`)
            );
          };
          break;
        case "progress":
          column.cellRenderer = ({ row }) => renderProgress(row);
          break;
        case sizeKey:
          column.cellRenderer = ({ row }) => {
            const size = row[sizeKey];
            return size === null || size === undefined
              ? h("span", "—")
              : h("span", formatBytes(size));
          };
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
