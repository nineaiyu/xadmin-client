import { h, reactive, shallowRef } from "vue";
import { useI18n } from "vue-i18n";
import { ElProgress, ElTag } from "element-plus";
// 文件大小格式化统一走框架工具（与文件管理页同一实现，避免两套口径）
import { formatBytes } from "@pureadmin/utils";
import { getDefaultAuths } from "@/router/utils";
import { statusTagProps, type StatusTagType } from "@/utils/dict";
import type { OperationProps, PageTableColumn } from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { openTaskLogDialog } from "@/views/system/components/taskLogDialog";
import ArrowDown from "~icons/ri/arrow-down-line";
import FileList from "~icons/ri/file-list-3-line";

/**
 * 导入动作的 tag 类型兜底映射（字典项未配置 color 时使用）。
 * 键与后端 ImportRecord.Action 取值（小写 create/update）一致，未命中回退 info。
 */
const ACTION_TAG_TYPE: Record<string, StatusTagType> = {
  create: "success",
  update: "primary"
};

/** 进度归一化：兼容 0~1 比值与 0~100 百分比两种后端口径 */
export function normalizeProgress(value: unknown): number {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num) || num <= 0) return 0;
  // 仅 (0,1) 的小数按比值处理：整数 1 视为 1%（后端下发 0~100 整数）
  const percent = num > 0 && num < 1 ? num * 100 : num;
  return Math.min(100, Math.round(percent));
}

/** 记录 API 最小契约：exportRecordApi / importRecordApi 均实现 */
interface RecordCenterApi {
  download: (pk: string | number) => Promise<unknown>;
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
  const { t, te } = useI18n();

  /** 打开任务日志弹窗（复用任务执行日志的 WS 增量消费组件） */
  const openLog = (pk: string | number, name: string) => {
    openTaskLogDialog(pk, `${name} ${t(`${localePrefix}.logTitle`)}`);
  };

  /** 字典 label 优先，回退页面 i18n；两边都没有时不渲染原始 key */
  const labelOrFallback = (
    dictItem: { label?: string } | undefined,
    key: string
  ) => dictItem?.label ?? (te(key) ? t(key) : "—");

  /** 进度列：RUNNING 进度条，SUCCESS 100%，其余显示 — */
  const renderProgress = row => {
    const statusValue = row.status?.value ?? row.status;
    if (statusValue === "RUNNING") {
      return h(ElProgress, {
        percentage: normalizeProgress(row.progress),
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
        onClick: async ({ row }) => {
          // autoDownload 在业务失败/无文件时会 reject（拦截器已 toast），
          // 这里显式 catch，避免按钮点击产生 unhandled rejection
          try {
            await api.download(row?.pk ?? row?.id);
          } catch {
            // 失败提示由 http 拦截器统一处理
          }
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
            return h(ElTag, statusTagProps(row.status), () =>
              labelOrFallback(
                row.status,
                `${localePrefix}.status${statusValue}`
              )
            );
          };
          break;
        case "action":
          // 导入动作（import_action 字典驱动）：color 优先彩色 tag（字典色统一
          // 走 statusTagProps，避免 ElTag 只换背景导致字体色与字典不一致），
          // 无色回退 ACTION_TAG_TYPE；label 字典优先回退页面 i18n
          column.cellRenderer = ({ row }) => {
            const action = row.action;
            const actionValue = action?.value ?? action;
            return h(ElTag, statusTagProps(action, ACTION_TAG_TYPE), () =>
              labelOrFallback(action, `${localePrefix}.action${actionValue}`)
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
