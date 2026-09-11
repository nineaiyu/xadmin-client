import type { CSSProperties, Ref } from "vue";
import { message } from "@/utils/message";
import { invalidateMetaCache } from "@/utils/metaCache";
import type { RecordType } from "plus-pro-components";
import { ElMessageBox } from "element-plus";
import type { TableColumnRenderer } from "@pureadmin/table";
import type { ApiResult, DetailResult } from "@/api/types";

interface operationOptions {
  t: (arg0: string, arg1?: object) => string;
  /** 标准接口请求（`create`/`update` 返回 `DetailResult`，其余写操作返回 `BaseResult`，读取仅依赖 `code`/`detail`） */
  apiReq?: Promise<ApiResult>;
  showSuccessMsg?: boolean;
  showFailedMsg?: boolean;
  success?: (res?: DetailResult) => void;
  failed?: (res?: DetailResult) => void;
  exception?: (res?: DetailResult) => void;
  requestEnd?: (options?: operationOptions) => void;
}

/**
 * 请求接口封装
 * @param options
 */
const handleOperation = (options: operationOptions) => {
  const {
    t,
    apiReq = undefined,
    showSuccessMsg = true,
    showFailedMsg = true,
    success,
    failed,
    exception,
    requestEnd
  } = options;

  apiReq
    ?.then((res: DetailResult) => {
      if (res.code === 1000) {
        // 写操作成功即失效共享元数据缓存（菜单等全量列表）：避免「刚保存的改动
        // 在其它页面的树/下拉里看不到」。命中缓存的下次读取会重新拉取。
        invalidateMetaCache();
        if (showSuccessMsg) {
          message(res.detail ?? t("results.success"), { type: "success" });
        }
        if (success) {
          success(res);
        }
      } else {
        if (showFailedMsg) {
          message(`${t("results.failed")}，${res.detail}`, { type: "error" });
        }
        if (failed) {
          failed(res);
        }
      }
    })
    .catch(err => {
      if (exception) {
        exception(err);
      }
    })
    .finally(() => {
      if (requestEnd) {
        requestEnd(options);
      }
    });
};

interface changeOptions {
  t: (arg0: string, arg1?: object) => string;
  updateApi: (pk: string | number, data: object) => Promise<ApiResult>; // 更新方法
  switchLoadMap: Ref;
  index: number; // 更新行索引
  row: {
    pk?: string | number;
    id?: string | number;
  }; // 更新的表单数据
  field: string; // 更新的字段
  actionMsg: string;
  msg?: string;
  success?: (res?: DetailResult) => void;
  failed?: (res?: DetailResult) => void;
  requestEnd?: (options?: operationOptions) => void;
}

/** 确认弹窗走 dangerouslyUseHTMLString，插值（含服务端列名/文案）必须转义防注入 */
const escapeHtml = (value: unknown): string =>
  String(value ?? "").replace(
    /[&<>"']/g,
    char =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[char] as string
  );

const onSwitchChange = (changeOptions: changeOptions) => {
  const {
    t,
    updateApi,
    switchLoadMap,
    index,
    row,
    field,
    actionMsg,
    msg = "",
    success,
    failed,
    requestEnd
  } = changeOptions;
  ElMessageBox.confirm(
    `${t("buttons.operateConfirm", {
      action: `<strong>${escapeHtml(actionMsg)}</strong>`,
      message: `<strong style="color:var(--el-color-primary)">${escapeHtml(msg)}</strong>`
    })}`,
    {
      confirmButtonText: t("buttons.sure"),
      cancelButtonText: t("buttons.cancel"),
      type: "warning",
      dangerouslyUseHTMLString: true,
      draggable: true
    }
  )
    .then(() => {
      switchLoadMap.value[index] = Object.assign(
        {},
        switchLoadMap.value[index],
        {
          loading: true
        }
      );
      const updateData = {};
      updateData[field] = row[field];
      handleOperation({
        t,
        apiReq: updateApi(row?.pk ?? row?.id, updateData),
        requestEnd(options) {
          switchLoadMap.value[index] = Object.assign(
            {},
            switchLoadMap.value[index],
            {
              loading: false
            }
          );
          if (requestEnd) {
            requestEnd(options);
          }
        },
        success,
        failed,
        exception() {
          row[field] = row[field] === false;
        }
      });
    })
    .catch(() => {
      row[field] = row[field] === false;
    });
};

interface switchOptions {
  t: (arg0: string, arg1?: object) => string;
  updateApi: (pk: string | number, data: object) => Promise<ApiResult>; // 更新方法
  switchLoadMap: Ref;
  switchStyle: Ref<CSSProperties>;
  field: string; // 更新的字段
  actionMap?: object; // msg映射 {true:'发布',false:'未发布'}
  activeMap?: object; // active映射 {true:'发布',false:'未发布'}
  msg?: string;
  actionMsg?: string;
  disabled?: (row?: RecordType) => boolean;
  success?: (res?: DetailResult) => void;
  failed?: (res?: DetailResult) => void;
  requestEnd?: (options?: operationOptions) => void;
}

const renderSwitch = (switchOptions: switchOptions) => {
  const {
    t,
    switchLoadMap,
    switchStyle,
    updateApi,
    field,
    actionMap,
    activeMap,
    success,
    failed,
    requestEnd,
    msg = undefined,
    actionMsg = undefined,
    disabled
  } = switchOptions;

  const defaultActionMap = {
    true: t("labels.enable"),
    false: t("labels.disable"),
    ...(actionMap ?? {})
  };

  const defaultActiveMap = {
    true: true,
    false: false,
    ...(activeMap ?? {})
  };
  return (scope: TableColumnRenderer) => (
    <el-switch
      size={scope.props.size === "small" ? "small" : "default"}
      loading={switchLoadMap.value[scope.index]?.loading}
      v-model={scope.row[field]}
      active-value={defaultActiveMap["true"]}
      inactive-value={defaultActiveMap["false"]}
      active-text={defaultActionMap["true"]}
      inactive-text={defaultActionMap["false"]}
      inline-prompt
      disabled={disabled && disabled(scope.row)}
      style={switchStyle.value}
      onChange={() => {
        onSwitchChange({
          t,
          msg: msg ?? scope.column.label,
          field,
          updateApi,
          switchLoadMap,
          row: scope.row,
          index: scope.index,
          actionMsg:
            actionMsg ?? defaultActionMap[defaultActiveMap[scope.row[field]]],
          success,
          failed,
          requestEnd
        });
      }}
    />
  );
};

interface booleanTagOptions {
  t: (arg0: string, arg1?: object) => string;
  tagStyle: Ref<(status: boolean) => CSSProperties>;
  field: string; // 字段
  actionMap?: object; // msg映射 {true:'发布',false:'未发布'}
  disabled?: boolean;
}

const renderBooleanTag = (booleanTagOptions: booleanTagOptions) => {
  const { t, tagStyle, field, actionMap } = booleanTagOptions;
  const defaultActionMap = {
    true: t("labels.enable"),
    false: t("labels.disable"),
    ...actionMap
  };
  return (scope: TableColumnRenderer) => (
    <el-tag size={scope.props.size} style={tagStyle.value(scope.row[field])}>
      {defaultActionMap[scope.row[field]]}
    </el-tag>
  );
};

// 弹层（openDialogDrawer）与导入导出（handleExportData/handleImportData）已按职责
// 拆分至 handle-dialog / handle-record，此处仅 re-export 保持既有导入路径不变
export { openDialogDrawer } from "./handle-dialog";
export { handleExportData, handleImportData } from "./handle-record";
export type {
  formDialogDrawerOptions,
  DialogFormInstance
} from "./handle-dialog";
export type { exportDataOptions, importDataOptions } from "./handle-record";
export { renderSwitch, onSwitchChange, handleOperation, renderBooleanTag };
export type { changeOptions, switchOptions, operationOptions };
