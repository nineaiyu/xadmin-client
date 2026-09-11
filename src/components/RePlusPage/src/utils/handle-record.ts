import { addDialog } from "@/components/ReDialog/index";
import { h, toRaw, type Ref } from "vue";
import type { RecordType } from "plus-pro-components";
import type { BaseApi } from "@/api/base";
import type { DetailResult } from "@/api/types";
import { resourcesIDCacheApi } from "@/api/common";
import ExportData from "../components/ExportData.vue";
import ImportData from "../components/ImportData.vue";
import ImportValidateResult from "../components/ImportValidateResult.vue";
import { openDialogDrawer, EXPORT_IMPORT_DIALOG_WIDTH } from "./handle-dialog";

export interface exportDataOptions {
  mode?: "dialog" | "drawer";
  t: (arg0: string, arg1?: object) => string;
  api: Partial<BaseApi>;
  pks: Array<string | number>;
  allowTypes?: Array<string>;
  searchFields?: Ref;
  /** 是否提供「异步导出」开关（大数据量场景，产物在下载中心获取） */
  allowAsync?: boolean;
}

// 数据导出
export const handleExportData = (options: exportDataOptions) => {
  const {
    t,
    mode,
    api,
    pks,
    allowTypes = ["all", "search", "selected"],
    searchFields = undefined,
    allowAsync = false
  } = options;

  openDialogDrawer({
    t,
    mode,
    title: t("exportImport.export"),
    rawRow: {
      type: "xlsx",
      range: pks.length > 0 ? "selected" : "all",
      pks: pks
    },
    props: {
      allowTypes,
      allowAsync
    },
    dialogDrawerOptions: { width: EXPORT_IMPORT_DIALOG_WIDTH },
    form: ExportData,
    saveCallback: async ({ formData, done, closeLoading, success, failed }) => {
      // 同步导出直接触发浏览器下载；异步导出提交后台任务，提示去下载中心取件。
      // 失败保持弹窗打开可重试（与导入失败策略对齐），仅成功/提交成功后关闭
      let ok = true;
      const exportBy = async (params: object) => {
        if (formData.async) {
          const res = await api.exportAsync(params);
          if (res?.code === 1000) {
            success(t("exportImport.asyncSubmitted"));
          } else {
            // 200 + 业务码非 1000 时全局拦截器不提示，这里必须显式报错
            ok = false;
            failed(res?.detail ?? t("results.failed"));
          }
        } else {
          await api.exportData(params);
        }
      };
      try {
        if (formData.range === "all") {
          await exportBy(formData);
        } else if (formData.range === "search" && searchFields) {
          // 在副本上拼导出参数：直接写 searchFields 会污染列表页的查询条件
          await exportBy({
            ...toRaw(searchFields.value),
            type: formData["type"]
          });
        } else if (formData.range === "selected") {
          const res = await resourcesIDCacheApi(formData.pks);
          formData["spm"] = res.spm;
          delete formData.pks;
          await exportBy(formData);
        }
      } catch {
        // HTTP 异常（拦截器已 toast）：视为失败，保持弹窗可重试
        ok = false;
      } finally {
        closeLoading();
      }
      if (ok) {
        done();
      }
    }
  });
};

export interface importDataOptions {
  mode?: "dialog" | "drawer";
  t: (arg0: string, arg1?: object) => string;
  api: Partial<BaseApi>;
  success?: (res?: DetailResult) => void;
}

/**
 * 导入参数：三条链路（同步 / 校验 / 异步）共用同一份。
 *
 * - 列映射：套用模板时下发 template_id（后端按模型校验可见性），否则下发 mapping 明文；
 *   两者互斥——用户改动映射后前端会清空 template_id，避免模板覆盖手工映射；
 * - 未映射列：后端默认丢弃，仅在用户显式勾选「保留未映射列」时下发 ignore_unknown=false。
 */
export const buildImportParams = (formData: RecordType) => {
  const params: RecordType = { action: formData.action };
  if (formData.template_id) {
    params.template_id = formData.template_id;
  } else if (formData.mapping && Object.keys(formData.mapping).length > 0) {
    params.mapping = JSON.stringify(formData.mapping);
  }
  if (formData.ignore_unknown === false) {
    params.ignore_unknown = "false";
  }
  return params;
};

// 数据导入
export const handleImportData = (options: importDataOptions) => {
  const { t, api, mode } = options;

  openDialogDrawer({
    t,
    mode,
    title: t("exportImport.import"),
    rawRow: {
      type: "xlsx",
      action: "create",
      ignore_error: false,
      mode: "import",
      async: false,
      api: api
    },
    dialogDrawerOptions: { width: EXPORT_IMPORT_DIALOG_WIDTH },
    form: ImportData,
    saveCallback: async ({ formData, success, failed, closeLoading }) => {
      // 取文件在 try 之外，必须先判空：空值会抛 TypeError 且 closeLoading 不执行
      const file = formData.upload?.[0]?.raw;
      if (!file) {
        failed(t("exportImport.pleaseSelectFile"), false);
        return;
      }
      try {
        const importParams = buildImportParams(formData);
        // 仅校验：逐行校验不落库，弹窗展示错误行定位
        if (formData.mode === "validate") {
          const res = await api.importValidate(importParams, file);
          if (res.code !== 1000) {
            failed(res.detail, false);
            return;
          }
          addDialog({
            title: t("exportImport.validateResult"),
            width: "640px",
            hideFooter: true,
            destroyOnClose: true,
            props: {
              total: res.data.total,
              validCount: res.data.valid_count,
              invalidCount: res.data.invalid_count,
              errorsTruncated: res.data.errors_truncated,
              errors: res.data.errors,
              // 字段名 → 原始表头：错误行按源文件列名展示，便于对照
              fieldTitles: res.data.field_titles ?? {},
              unmatchedColumns: res.data.unmatched_columns ?? []
            },
            contentRenderer: () => h(ImportValidateResult)
          });
          success(t("exportImport.validateDone"), false);
          return;
        }
        // 异步导入：提交后台任务，进度与错误报告在下载中心「导入记录」获取
        if (formData.async) {
          const res = await api.importAsync(importParams, file);
          if (res.code === 1000) {
            if (options?.success) {
              options?.success(res);
            }
            // 提交成功即关闭（success 统一 toast，勿重复弹提示）
            success(t("exportImport.importSubmitted"), true);
          } else {
            failed(res.detail, false);
          }
          return;
        }
        // 同步导入（原有行为不变）
        const res = await api.importData(
          { ...importParams, ignore_error: formData.ignore_error },
          file
        );
        if (res.code === 1000) {
          if (options?.success) {
            options?.success(res);
          }
          success(res.detail);
        } else {
          failed(res.detail, false);
        }
      } finally {
        closeLoading();
      }
    }
  });
};
