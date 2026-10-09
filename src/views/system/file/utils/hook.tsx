import { reactive, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { systemUploadFileApi } from "@/api/file/file";
import { hasAuth, usePageAuth } from "@/router/utils";
import { usePublicHooks } from "@/views/system/hooks";
import { withFileUrlRequiredRule } from "./fileFormRules";
import { useFileTagActions } from "./useFileTagActions";
import { useFileQuotaStats } from "./useFileQuotaStats";
import { useFileButtons } from "./useFileButtons";
import { buildFileColumns } from "./fileColumns";
import type { RePlusPageProps } from "@/components/RePlusPage";
import type { RecordType } from "plus-pro-components";

/**
 * 文件中心装配：配额统计与分类（useFileQuotaStats）、通用标签（useFileTagActions）、
 * 按钮（useFileButtons）与列渲染（fileColumns.tsx）。
 */
export function useSystemUploadFile(tableRef: Ref) {
  const { t } = useI18n();

  const api = reactive(systemUploadFileApi);

  const { tagStyle } = usePublicHooks();

  const auth = usePageAuth();
  auth.upload = hasAuth("upload:SystemUploadFile");
  auth.config = hasAuth("config:SystemUploadFile");
  auth.preview = hasAuth("preview:SystemUploadFile");

  // 通用标签：行内打标（单对象全量替换）与工具栏批量打标共用同一弹窗；
  // 入口按全局 assign:Tag 权限点显示，对象级 update 权限由后端逐对象复核
  const {
    canAssignTags,
    openTagDialog,
    selectedNum,
    handleBatchTags,
    selectionChange
  } = useFileTagActions({ tableRef });

  // 配额统计与分类下拉（搜索区）
  const { stats, loadStats, searchColumnsFormat } = useFileQuotaStats({
    hasListAuth: Boolean(auth.list)
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
    canPreview: auth.preview
  });

  return {
    api,
    auth,
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
