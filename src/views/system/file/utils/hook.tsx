import { shallowRef } from "vue";
import { systemUploadFileApi } from "@/api/file/file";
import { hasAuth } from "@/router/utils";
import { usePublicHooks } from "@/views/system/hooks";
import { withFileUrlRequiredRule } from "./fileFormRules";
import { useFileTagActions } from "./useFileTagActions";
import { useFileQuotaStats } from "./useFileQuotaStats";
import { useFileButtons } from "./useFileButtons";
import { buildFileColumns } from "./fileColumns";
import { defineListPage, type RePlusPageProps } from "@/components/RePlusPage";
import type { RecordType } from "plus-pro-components";

/**
 * 文件中心装配：配额统计与分类（useFileQuotaStats）、通用标签（useFileTagActions）、
 * 按钮（useFileButtons）与列渲染（fileColumns.tsx）。
 */
export function useSystemUploadFile() {
  const page = defineListPage({
    api: systemUploadFileApi,
    localeName: "systemUploadFile"
  });
  const { api, auth, tableRef, t } = page;

  const { tagStyle } = usePublicHooks();

  auth.upload = hasAuth("upload:SystemUploadFile");
  auth.config = hasAuth("config:SystemUploadFile");
  auth.preview = hasAuth("preview:SystemUploadFile");
  // 下载是独立权限点（不在 usePageAuth 默认动作清单内）：列表列与行操作共用
  auth.download = hasAuth("download:SystemUploadFile");
  // 配额统计是独立权限点：不再借用 retrieve 代填权限边界
  auth.stats = hasAuth("stats:SystemUploadFile");

  // 通用标签：行内打标（单对象全量替换）与工具栏批量打标共用同一弹窗；
  // 入口按全局 assign:Tag 权限点显示，对象级 update 权限由后端逐对象复核
  const {
    canAssignTags,
    openTagDialog,
    selectedNum,
    handleBatchTags,
    selectionChange
  } = useFileTagActions({ tableRef });

  // 配额统计与分类下拉（搜索区）：独立 stats 权限点
  const { stats, loadStats, searchColumnsFormat } = useFileQuotaStats({
    hasStatsAuth: Boolean(auth.stats)
  });

  const { operationButtonsProps, tableBarButtonsProps } = useFileButtons({
    t,
    api,
    tableRef,
    auth,
    canAssignTags,
    selectedNum,
    handleBatchTags,
    loadStats,
    openTagDialog
  });

  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      formProps: {
        // 上传登记/存量外链行要求 file_url 为合法 URL（规则见 fileFormRules，可单测直测）
        rules: ({
          rawFormProps: { rules },
          isAdd,
          rawRow
        }: {
          rawFormProps: { rules: RecordType };
          isAdd?: boolean;
          rawRow?: RecordType;
        }) => withFileUrlRequiredRule(rules, { isAdd, rawRow })
      }
    }
  });

  const { listColumnsFormat } = buildFileColumns({
    t,
    tagStyle,
    canPreview: auth.preview,
    canDownload: auth.download,
    onDownload: row => {
      // 与行操作同一受鉴权端点（服务端记访问审计）；失败由 http 层提示，
      // 这里吞掉 rejection 避免 cellRenderer 内产生未处理异常
      void api
        .download(row?.pk as string | number, row?.filename as string)
        .catch(() => undefined);
    }
  });

  return {
    ...page,
    stats,
    loadStats,
    searchColumnsFormat,
    listColumnsFormat,
    addOrEditOptions,
    tableBarButtonsProps,
    operationButtonsProps,
    selectionChange
  };
}
