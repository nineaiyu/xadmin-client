import { addDialog, type DialogOptions } from "@/components/ReDialog/index";
import { deviceDetection } from "@pureadmin/utils";
import { type Component, h, type Ref, ref, toRaw } from "vue";
import { cloneDeep } from "lodash-es";
import { message } from "@/utils/message";
import addOrEdit from "../components/addOrEdit.vue";
import type { PlusColumn, PlusFormProps } from "plus-pro-components";
import { ElMessageBox, type FormInstance } from "element-plus";
import type { BaseApi } from "@/api/base";
import type { DetailResult } from "@/api/types";
import { uniqueArrayObj } from "@/components/RePlusCRUD";
import exportDataForm from "@/components/RePlusCRUD/src/components/exportData.vue";
import { resourcesIDCacheApi } from "@/api/common";
import importDataForm from "@/components/RePlusCRUD/src/components/importData.vue";

interface callBackArgs {
  formData: Object | any;
  formRef: FormInstance;
  formOptions: formDialogOptions;
  closeLoading: Function;
  success: (close?: boolean) => void;
  failed: (detail: string, close?: boolean) => void;
  done: Function;
}

interface formDialogOptions {
  t: Function;
  isAdd?: boolean;
  row?: Function | Object; //  外部处理方法
  title: string; // 弹窗的的title
  formValue?: Ref; // 表单值
  rawRow: Object; //  默认数据或者更新的书籍
  minWidth?: string; // 弹窗的的最小宽度
  columns?: Function | Object; // 表单字段
  rawColumns?: PlusColumn[] | Array<any>; // 表单字段
  form?: Component | any; // 挂载的form组件，默认是addOrEdit组件
  props?: Function | Object; //  内容区组件的 props，可通过 defineProps 接收
  formProps?: Function | Object; //  plus form 的props
  rawFormProps?: PlusFormProps; //  plus form 的props
  dialogOptions?: DialogOptions; // dialog options
  beforeSubmit?: ({
    formData,
    formRef,
    formOptions
  }: {
    formData: object | any;
    formRef: Ref;
    formOptions: formDialogOptions;
  }) => object | any;
  saveCallback?: ({
    formData,
    formRef,
    formOptions,
    closeLoading,
    success,
    failed,
    done
  }: callBackArgs) => void; // 点击保存回调
}

const openFormDialog = (formOptions: formDialogOptions) => {
  const formRef = ref();
  const rowResult = {};
  Object.keys(formOptions?.row ?? {}).forEach(key => {
    const getValue = formOptions.row[key];
    if (typeof formOptions.row[key] === "function") {
      rowResult[key] = getValue(cloneDeep(formOptions));
    } else {
      rowResult[key] = getValue;
    }
  });

  const formInline = {
    ...(cloneDeep(formOptions?.rawRow) ?? {}),
    ...rowResult
  };

  formOptions.formValue = formOptions.formValue ?? ref(cloneDeep(formInline));

  const propsResult = {};
  Object.keys(formOptions?.props ?? {}).forEach(key => {
    const getValue = formOptions.props[key];
    if (typeof formOptions.props[key] === "function") {
      propsResult[key] = getValue(cloneDeep(formOptions));
    } else {
      propsResult[key] = getValue;
    }
  });

  // let editColumns = [];
  // if (typeof formOptions?.columns === "function") {
  //   editColumns = formOptions.columns(cloneDeep(formOptions));
  // } else {
  //   editColumns = [...(formOptions?.columns ?? [])];
  // }
  const rawColumns = {};
  cloneDeep(formOptions?.rawColumns ?? []).forEach(column => {
    rawColumns[column._column?.key ?? column.prop] = column;
  });
  let editColumns = {};
  Object.keys(formOptions?.columns ?? {}).forEach(key => {
    const getValue = formOptions.columns[key];
    if (typeof formOptions.columns[key] === "function") {
      try {
        editColumns[key] = getValue({
          ...cloneDeep({ ...formOptions, column: rawColumns[key] }),
          formValue: formOptions.formValue
        });
      } catch (err) {
        console.warn(err);
      }
    } else {
      editColumns[key] = getValue;
    }
  });

  const formPropsResult = {};

  Object.keys(formOptions?.formProps ?? {}).forEach(key => {
    const getValue = formOptions?.formProps[key];
    if (typeof formOptions?.formProps[key] === "function") {
      formPropsResult[key] = getValue(cloneDeep(formOptions));
    } else {
      formPropsResult[key] = getValue;
    }
  });
  const clientWidth = document.documentElement.clientWidth;
  const minWidth = Number((formOptions.minWidth ?? "600px").replace("px", ""));
  const width = formOptions?.dialogOptions?.width ?? "50%";
  let numberWidth = 0;
  if (width.endsWith("%") || width.endsWith("vw")) {
    numberWidth =
      (clientWidth * Number(width.replace("%", "").replace("vw", ""))) / 100;
  } else {
    numberWidth = Number(width.replace("px", ""));
  }
  addDialog({
    title: formOptions.title,
    props: {
      formInline,
      ...propsResult,
      columns: uniqueArrayObj(
        [
          ...(formOptions?.rawColumns ?? []),
          ...(Object.values(editColumns) ?? [])
        ],
        "prop"
      ),
      formProps: { ...formOptions?.rawFormProps, ...(formPropsResult ?? {}) }
    },
    draggable: true,
    sureBtnLoading: true,
    fullscreen: deviceDetection(),
    destroyOnClose: true,
    fullscreenIcon: true,
    closeOnClickModal: false,
    contentRenderer: () => h(formOptions?.form ?? addOrEdit, { ref: formRef }),
    beforeSure: async (done, { options, closeLoading }) => {
      const FormRef: FormInstance = formRef.value.getRef();
      const formInlineData = cloneDeep(options.props.formInline);

      const success = (close = true) => {
        message(formOptions?.t("results.success"), {
          type: "success"
        });
        closeLoading();
        close && done(); // 关闭弹框
      };

      const failed = (detail: string, close = false) => {
        message(`${formOptions?.t("results.failed")}，${detail}`, {
          type: "error"
        });
        closeLoading();
        close && done(); // 关闭弹框
      };

      await FormRef?.validate(valid => {
        if (valid) {
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
        } else {
          closeLoading();
        }
      });
    },
    ...formOptions?.dialogOptions,
    width: `${minWidth > numberWidth ? minWidth : numberWidth}px`,
    onChange(data) {
      if (data?.values) {
        formOptions.formValue.value = data?.values?.values;
      }
      formOptions?.dialogOptions?.onChange &&
        formOptions?.dialogOptions?.onChange(data);
    }
  });
};

interface operationOptions {
  t: Function;
  apiReq: Promise<any>;
  showSuccessMsg?: boolean;
  showFailedMsg?: boolean;
  success?: (res?: DetailResult) => void;
  failed?: (res?: DetailResult) => void;
  exception?: (res?: DetailResult) => void;
  requestEnd?: (options?: operationOptions) => void;
}

const handleOperation = (options: operationOptions) => {
  let {
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
        showSuccessMsg &&
          message(res.detail ?? t("results.success"), { type: "success" });
        success && success(res);
      } else {
        showFailedMsg &&
          message(`${t("results.failed")}，${res.detail}`, { type: "error" });
        failed && failed(res);
      }
    })
    .catch(err => {
      exception && exception(err);
    })
    .finally(() => {
      requestEnd && requestEnd(options);
    });
};

interface changeOptions {
  t: Function;
  updateApi: Function; // 更新方法
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
          requestEnd && requestEnd(options);
        },
        success,
        failed,
        exception() {
          row[field] === false ? (row[field] = true) : (row[field] = false);
        }
      });
    })
    .catch(() => {
      row[field] === false ? (row[field] = true) : (row[field] = false);
    });
};

interface switchOptions {
  t: Function;
  updateApi: Function; // 更新方法
  switchLoadMap: Ref;
  switchStyle: Ref;
  field: string; // 更新的字段
  actionMap?: object; // msg映射 {true:'发布',false:'未发布'}
  activeMap?: object; // active映射 {true:'发布',false:'未发布'}
  msg?: string;
  actionMsg?: string;
  disabled?: (row?: any) => boolean;
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
  return scope => (
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
  t: Function;
  tagStyle: Ref;
  field: string; // 字段
  actionMap?: object; // msg映射 {true:'发布',false:'未发布'}
  disabled?: boolean;
}

const renderBooleanTag = (booleanTagOptions: booleanTagOptions) => {
  const { t, tagStyle, field, disabled, actionMap } = booleanTagOptions;
  const defaultActionMap = {
    true: t("labels.enable"),
    false: t("labels.disable"),
    ...actionMap
  };
  return scope => (
    <el-tag
      size={scope.props.size}
      style={tagStyle.value(scope.row[field])}
      disabled={disabled}
    >
      {defaultActionMap[scope.row[field]]}
    </el-tag>
  );
};

interface exportDataOptions {
  t: Function;
  api: BaseApi;
  pks: Array<string | number>;
  allowTypes?: Array<string>;
  searchFields?: Ref;
}

// 数据导出
const handleExportData = (options: exportDataOptions) => {
  const {
    t,
    api,
    pks,
    allowTypes = ["all", "search", "selected"],
    searchFields = undefined
  } = options;

  openFormDialog({
    t,
    title: t("exportImport.export"),
    rawRow: {
      type: "xlsx",
      range: pks.length > 0 ? "selected" : "all",
      pks: pks
    },
    props: {
      allowTypes
    },
    dialogOptions: { width: "600px" },
    form: exportDataForm,
    saveCallback: async ({ formData, done, closeLoading }) => {
      if (formData.range === "all") {
        await api.export(formData).finally(() => {
          closeLoading();
        });
      } else if (formData.range === "search" && searchFields) {
        searchFields.value["type"] = formData["type"];
        await api.export(toRaw(searchFields.value)).finally(() => {
          closeLoading();
        });
      } else if (formData.range === "selected") {
        resourcesIDCacheApi(formData.pks)
          .then(async res => {
            formData["spm"] = res.spm;
            delete formData.pks;
            await api.export(formData).finally(() => {
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
  t: Function;
  api: BaseApi;
  success?: (res?: DetailResult) => void;
}

// 数据导入
const handleImportData = (options: importDataOptions) => {
  const { t, api } = options;

  openFormDialog({
    t,
    title: t("exportImport.import"),
    rawRow: {
      action: "create",
      api: api
    },
    dialogOptions: { width: "600px" },
    form: importDataForm,
    saveCallback: ({ formData, success, failed, closeLoading }) => {
      api
        .import(formData.action, formData.upload[0].raw)
        .then(res => {
          if (res.code === 1000) {
            options?.success && options?.success(res);
            success();
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
  openFormDialog,
  handleOperation,
  onSwitchChange,
  renderSwitch,
  renderBooleanTag,
  handleExportData,
  handleImportData
};
export type {
  operationOptions,
  changeOptions,
  switchOptions,
  formDialogOptions,
  exportDataOptions,
  importDataOptions
};
