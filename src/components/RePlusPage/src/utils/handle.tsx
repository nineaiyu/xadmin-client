import {
  addDialog,
  type ArgsType,
  type DialogOptions
} from "@/components/ReDialog/index";
import { deviceDetection } from "@pureadmin/utils";
import {
  type Component,
  type CSSProperties,
  h,
  type Ref,
  ref,
  toRaw
} from "vue";
import { cloneDeep } from "lodash-es";
import { message } from "@/utils/message";
import type { PlusFormProps, RecordType } from "plus-pro-components";
import { ElMessageBox } from "element-plus";
import type { BaseApi } from "@/api/base";
import type {
  ApiResult,
  DetailResult,
  SearchColumnsResult,
  SearchFieldsResult
} from "@/api/types";
import type { TableColumnRenderer } from "@pureadmin/table";
import {
  type ExposedFormInstance,
  uniqueArrayObj
} from "@/components/RePlusPage";
import { resourcesIDCacheApi } from "@/api/common";
import AddOrEdit from "../components/AddOrEdit.vue";
import ExportData from "../components/ExportData.vue";
import ImportData from "../components/ImportData.vue";
import { addDrawer, type DrawerOptions } from "@/components/ReDrawer/index";

const modeFuncMap = {
  drawer: addDrawer,
  dialog: addDialog
} satisfies {
  [key in "dialog" | "drawer"]: (
    options: Partial<DrawerOptions & DialogOptions>
  ) => void;
};

/**
 * 动态属性表：每个键的值可以是静态值，也可以是接收表单上下文求值的解析器。
 * openDialogDrawer 打开弹层前会统一解析（函数值会以表单上下文的深拷贝调用）。
 */
type DynamicSpec<TCtx = Partial<formDialogDrawerOptions>> = {
  [key: string]: unknown | ((formOptions: TCtx) => unknown);
};

interface callBackArgs {
  formData: RecordType;
  formRef: ExposedFormInstance | undefined;
  formOptions: formDialogDrawerOptions;
  closeLoading: () => void;
  success: (detail: string, close?: boolean) => void;
  failed: (detail: string, close?: boolean) => void;
  done: () => void;
}

/**
 * 弹层表单列的公共结构：运行时仅以 `prop` / `_column.key` 作为去重键，
 * 其余字段（含 plus-pro 的函数态 `fieldProps`）原样透传给弹层表单组件
 */
type ColumnBase = {
  prop?: string;
  _column?: Partial<
    SearchFieldsResult["data"][0] & SearchColumnsResult["data"][0]
  >;
  [key: string]: unknown;
};

type RawColumn = ColumnBase;

/**
 * 解析器上下文中的列：在公共结构之上保证 `fieldProps` 可就地增量配置
 * （传入 `rawColumns` 时 `fieldProps` 的对象形态由各视图自行保证）
 */
type EditableColumn = ColumnBase & {
  fieldProps?: {
    props?: object;
    disabled?: boolean;
    [key: string]: unknown;
  };
};

/** 表单列属性表：键值可为静态列对象或解析器（解析器上下文附带当前列 `column`） */
type ColumnSpec = {
  [key: string]:
    | RawColumn
    | ((
        formOptions: Partial<formDialogDrawerOptions> & {
          column: EditableColumn;
        }
      ) => RawColumn);
};

/**
 * dialog/drawer 共用回调契约：显式声明而非依赖 `DrawerOptions & DialogOptions`
 * 的同名回调交叉（交叉会产生重载签名，导致业务侧 lambda 上下文推断失败）。
 */
type DialogDrawerCallbacks = {
  /** 关闭回调，`args.command` 解析同 DialogOptions.closeCallBack */
  closeCallBack?: (data: {
    options: DialogOptions | DrawerOptions;
    index: number;
    args?: ArgsType;
  }) => void;
  /** 内容组件 `change` 事件透传载荷，`values` 形态由内容组件决定 */
  onChange?: (data: {
    options: DialogOptions | DrawerOptions;
    index: number;
    values: unknown;
  }) => void;
};

interface formDialogDrawerOptions {
  mode?: "dialog" | "drawer";
  t: (arg0: string, arg1?: object) => string;
  isAdd?: boolean;
  /** 外部处理方法：键值可为静态值或按表单上下文求值的解析器 */
  row?: DynamicSpec;
  /** 弹窗的title */
  title: string;
  /** 表单值（未传时由 `rawRow`/`row` 的解析结果初始化） */
  formValue?: Ref;
  /** 默认数据或者更新的数据 */
  rawRow: RecordType;
  /** 弹窗的的最小宽度 */
  minWidth?: string;
  /** 表单字段：键值可为静态列对象或解析器（解析器上下文附带当前列 `column`） */
  columns?: ColumnSpec;
  /** 表单字段 */
  rawColumns?: RawColumn[];
  /** 挂载的form组件，默认是AddOrEdit组件 */
  form?: Component;
  /** 内容区组件的 props，可通过 defineProps 接收 */
  props?: DynamicSpec;
  /** plus form 的props */
  formProps?: DynamicSpec;
  /** plus form 所在 tabs 的props */
  tabsProps?: DynamicSpec;
  /** plus form 的props */
  rawFormProps?: PlusFormProps;
  /** dialog options */
  dialogDrawerOptions?: Partial<
    Omit<DrawerOptions & DialogOptions, "closeCallBack" | "onChange">
  > &
    DialogDrawerCallbacks;
  beforeSubmit?: ({
    formData,
    formRef,
    formOptions
  }: {
    formData: RecordType;
    formRef: Ref<DialogFormInstance | undefined>;
    formOptions: formDialogDrawerOptions;
  }) => RecordType | undefined;
  /** 点击保存回调 */
  saveCallback?: (args: callBackArgs) => void;
}

/** 挂载在弹层内的表单组件需暴露的实例契约（AddOrEdit / ExportData / ImportData 均实现） */
interface DialogFormInstance {
  /** 分页签场景会在当前页实例上挂载 `_allInstances`，供外部统一校验全部表单 */
  getRef: () => ExposedFormInstance | undefined;
  setActiveName?: (index: number) => void;
}

/** 将动态属性表解析为静态属性表（函数值以表单上下文的深拷贝调用，与既有行为一致） */
function resolveSpec(
  spec: DynamicSpec | undefined,
  ctx: formDialogDrawerOptions
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  Object.keys(spec ?? {}).forEach(key => {
    const value = spec?.[key];
    if (typeof value === "function") {
      result[key] = (value as (ctx: unknown) => unknown)(cloneDeep(ctx));
    } else {
      result[key] = value;
    }
  });
  return result;
}

const openDialogDrawer = (formOptions: formDialogDrawerOptions) => {
  const formRef = ref<DialogFormInstance>();
  const rowResult = resolveSpec(formOptions.row, formOptions);

  const formInline = {
    ...(cloneDeep(formOptions?.rawRow) ?? {}),
    ...rowResult
  };

  formOptions.formValue = formOptions.formValue ?? ref(cloneDeep(formInline));

  const propsResult = resolveSpec(formOptions.props, formOptions);

  const rawColumnsMap: Record<string, RawColumn> = {};
  cloneDeep(formOptions?.rawColumns ?? []).forEach(column => {
    rawColumnsMap[column._column?.key ?? column.prop] = column;
  });
  const editColumns: Record<string, RawColumn> = {};
  Object.keys(formOptions?.columns ?? {}).forEach(key => {
    const getValue = formOptions.columns?.[key];
    if (typeof getValue === "function") {
      try {
        editColumns[key] = getValue({
          ...cloneDeep({
            ...formOptions,
            column: rawColumnsMap[key] as EditableColumn
          }),
          formValue: formOptions.formValue
        });
      } catch (err) {
        console.warn(err);
      }
    } else {
      editColumns[key] = getValue;
    }
  });

  const formPropsResult = resolveSpec(formOptions.formProps, formOptions);
  const tabsPropsResult = resolveSpec(formOptions.tabsProps, formOptions);

  const clientWidth = document.documentElement.clientWidth;
  const minWidth = Number((formOptions.minWidth ?? "600px").replace("px", ""));
  const width = formOptions?.dialogDrawerOptions?.width ?? "50%";
  let numberWidth: number;
  if (width.endsWith("%") || width.endsWith("vw")) {
    numberWidth =
      (clientWidth * Number(width.replace("%", "").replace("vw", ""))) / 100;
  } else {
    numberWidth = Number(width.replace("px", ""));
  }
  const func = modeFuncMap[formOptions.mode ?? "dialog"] ?? addDialog;
  func({
    title: formOptions.title,
    props: {
      formInline,
      ...propsResult,
      columns: uniqueArrayObj(
        [...(formOptions?.rawColumns ?? []), ...Object.values(editColumns)],
        "prop"
      ),
      formProps: { ...formOptions?.rawFormProps, ...formPropsResult },
      tabsProps: { ...tabsPropsResult }
    },
    draggable: true,
    sureBtnLoading: true,
    fullscreen: deviceDetection(),
    destroyOnClose: true,
    fullscreenIcon: true,
    closeOnClickModal: false,
    contentRenderer: () => h(formOptions?.form ?? AddOrEdit, { ref: formRef }),
    beforeSure: async (done, { options, closeLoading }) => {
      const FormRef = formRef.value.getRef();
      const allFormInstances = FormRef?._allInstances ?? [FormRef]; // 获取所有 PlusForm 实例
      const formInlineData = cloneDeep(options.props.formInline);

      const success = (detail = undefined, close = true) => {
        message(detail ?? formOptions?.t("results.success"), {
          type: "success"
        });
        closeLoading();
        if (close) {
          done();
        }
      };

      const failed = (detail: string, close = false) => {
        message(`${formOptions?.t("results.failed")}，${detail}`, {
          type: "error"
        });
        closeLoading();
        if (close) {
          done();
        }
      };

      for (let i = 0; i < allFormInstances.length; i++) {
        const valid = await allFormInstances[i]?.validate(valid => {
          if (!valid) {
            formRef.value.setActiveName(i);
            closeLoading();
          }
        });
        if (!valid) {
          return;
        }
      }
      const formData =
        (formOptions?.beforeSubmit &&
          formOptions?.beforeSubmit({
            formData: formInlineData,
            formRef: formRef,
            formOptions
          })) ||
        formInlineData;
      formOptions?.saveCallback({
        formData,
        formRef: FormRef,
        closeLoading,
        formOptions,
        success,
        failed,
        done
      });
    },
    ...formOptions?.dialogDrawerOptions,
    width: `${minWidth > numberWidth ? minWidth : numberWidth}px`,
    size: `${minWidth > numberWidth ? minWidth : numberWidth}`,
    onChange(data) {
      // 内容组件 change 透传：AddOrEdit 载荷为 { values, column }
      const payload = data?.values as
        { values?: RecordType; column?: unknown } | undefined;
      if (payload) {
        formOptions.formValue.value = payload.values;
      }
      if (formOptions?.dialogDrawerOptions?.onChange) {
        formOptions?.dialogDrawerOptions?.onChange(data);
      }
    }
  } as Partial<DrawerOptions & DialogOptions>);
};

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
      action: `<strong>${actionMsg}</strong>`,
      message: `<strong style="color:var(--el-color-primary)">${msg}</strong>`
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

interface exportDataOptions {
  mode?: "dialog" | "drawer";
  t: (arg0: string, arg1?: object) => string;
  api: Partial<BaseApi>;
  pks: Array<string | number>;
  allowTypes?: Array<string>;
  searchFields?: Ref;
}

// 数据导出
const handleExportData = (options: exportDataOptions) => {
  const {
    t,
    mode,
    api,
    pks,
    allowTypes = ["all", "search", "selected"],
    searchFields = undefined
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
      allowTypes
    },
    dialogDrawerOptions: { width: "600px" },
    form: ExportData,
    saveCallback: async ({ formData, done, closeLoading }) => {
      if (formData.range === "all") {
        await api.exportData(formData).finally(() => {
          closeLoading();
        });
      } else if (formData.range === "search" && searchFields) {
        searchFields.value["type"] = formData["type"];
        await api.exportData(toRaw(searchFields.value)).finally(() => {
          closeLoading();
        });
      } else if (formData.range === "selected") {
        resourcesIDCacheApi(formData.pks)
          .then(async res => {
            formData["spm"] = res.spm;
            delete formData.pks;
            await api.exportData(formData).finally(() => {
              closeLoading();
            });
          })
          .finally(() => {
            closeLoading();
          });
      }
      done();
    }
  });
};

interface importDataOptions {
  mode?: "dialog" | "drawer";
  t: (arg0: string, arg1?: object) => string;
  api: Partial<BaseApi>;
  success?: (res?: DetailResult) => void;
}

// 数据导入
const handleImportData = (options: importDataOptions) => {
  const { t, api, mode } = options;

  openDialogDrawer({
    t,
    mode,
    title: t("exportImport.import"),
    rawRow: {
      action: "create",
      ignore_error: false,
      api: api
    },
    dialogDrawerOptions: { width: "600px" },
    form: ImportData,
    saveCallback: ({ formData, success, failed, closeLoading }) => {
      api
        .importData(
          { action: formData.action, ignore_error: formData.ignore_error },
          formData.upload[0].raw
        )
        .then(res => {
          if (res.code === 1000) {
            if (options?.success) {
              options?.success(res);
            }
            success(res.detail);
          } else {
            failed(res.detail, false);
          }
        })
        .finally(() => {
          closeLoading();
        });
    }
  });
};

export {
  renderSwitch,
  onSwitchChange,
  handleOperation,
  openDialogDrawer,
  renderBooleanTag,
  handleExportData,
  handleImportData
};
export type {
  changeOptions,
  switchOptions,
  operationOptions,
  exportDataOptions,
  importDataOptions,
  formDialogDrawerOptions
};
