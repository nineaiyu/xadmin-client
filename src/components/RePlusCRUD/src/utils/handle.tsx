import { addDialog, type DialogOptions } from "@/components/ReDialog/index";
import { deviceDetection } from "@pureadmin/utils";
import { type Component, h, type Ref, ref } from "vue";
import { cloneDeep } from "lodash-es";
import { message } from "@/utils/message";
import addOrEdit from "../components/addOrEdit.vue";
import type { PlusColumn, PlusFormProps } from "plus-pro-components";
import { ElMessageBox, type FormInstance } from "element-plus";
import type { BaseApi } from "@/api/base";
import type { BaseResult } from "@/api/types";

interface callBackArgs {
  formData: Object | any;
  formRef: FormInstance;
  formOptions: formDialogOptions;
  success: (close?: boolean) => void;
  failed: (detail: string, close?: boolean) => void;
  done: Function;
}

interface formDialogOptions {
  t: Function;
  row: Function | Object; //  默认数据或者更新的书籍
  title: string; // 弹窗的的title
  columns?: Function | PlusColumn[] | Array<any>; // 表单字段
  form?: Component | any; // 挂载的form组件，默认是addOrEdit组件
  props?: Function | Object; //  内容区组件的 props，可通过 defineProps 接收
  formProps?: Function | PlusFormProps; //  plus form 的props
  dialogOptions?: DialogOptions; // dialog options
  saveCallback?: ({
    formData,
    formRef,
    formOptions,
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
      rowResult[key] = getValue(formOptions);
    } else {
      rowResult[key] = getValue;
    }
  });
  const propsResult = {};
  Object.keys(formOptions?.props ?? {}).forEach(key => {
    const getValue = formOptions.props[key];
    if (typeof formOptions.props[key] === "function") {
      propsResult[key] = getValue(formOptions);
    } else {
      propsResult[key] = getValue;
    }
  });
  let editColumns = [];
  if (typeof formOptions?.columns === "function") {
    editColumns = formOptions.columns(formOptions);
  } else {
    editColumns = [...(formOptions?.columns ?? [])];
  }

  const formPropsResult = {};

  Object.keys(formOptions?.formProps ?? {}).forEach(key => {
    const getValue = formOptions?.formProps[key];
    if (typeof formOptions?.formProps[key] === "function") {
      formPropsResult[key] = getValue(formOptions);
    } else {
      formPropsResult[key] = getValue;
    }
  });

  addDialog({
    title: formOptions.title,
    props: {
      formInline: {
        ...(formOptions?.row ?? {}),
        ...rowResult
      },
      ...propsResult,
      columns: editColumns ?? [],
      formProps: formPropsResult ?? {}
    },
    width: "40%",
    draggable: true,
    fullscreen: deviceDetection(),
    fullscreenIcon: true,
    closeOnClickModal: false,
    contentRenderer: () => h(formOptions?.form ?? addOrEdit, { ref: formRef }),
    beforeSure: async (done, { options }) => {
      const FormRef: FormInstance = formRef.value.getRef();
      const formData = cloneDeep(options.props.formInline);

      const success = (close = true) => {
        message(formOptions?.t("results.success"), {
          type: "success"
        });
        close && done(); // 关闭弹框
      };

      const failed = (detail: string, close = false) => {
        message(`${formOptions?.t("results.failed")}，${detail}`, {
          type: "error"
        });
        close && done(); // 关闭弹框
      };

      await FormRef.validate(valid => {
        if (valid) {
          formOptions?.saveCallback({
            formData,
            formRef: FormRef,
            formOptions,
            success,
            failed,
            done
          });
        }
      });
    },
    ...formOptions?.dialogOptions
  });
};

interface operationOptions {
  t: Function;
  apiUrl: BaseApi | any;
  row: {
    pk?: string | number;
    id?: string | number;
  };
  success?: (res?: BaseResult) => void;
  failed?: (res?: BaseResult) => void;
}

const handleOperation = (options: operationOptions) => {
  let req = null;

  const { t, apiUrl, row, success, failed } = options;
  switch (apiUrl.name) {
    case "create":
      req = apiUrl(row);
      break;
    case "update":
      req = apiUrl(row?.pk ?? row?.id, row);
      break;
    case "patch":
      req = apiUrl(row?.pk ?? row?.id, row);
      break;
    default:
      req = apiUrl(row?.pk ?? row?.id);
      break;
  }

  req &&
    req.then((res: BaseResult) => {
      if (res.code === 1000) {
        message(t("results.success"), { type: "success" });
        success && success(res);
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
        failed && failed(res);
      }
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
  actionMap: object; // msg映射 {true:'发布',false:'未发布'}
  msg?: string;
}

const onSwitchChange = (changeOptions: changeOptions) => {
  const {
    t,
    updateApi,
    switchLoadMap,
    index,
    row,
    field,
    actionMap,
    msg = ""
  } = changeOptions;
  ElMessageBox.confirm(
    `${t("buttons.operateConfirm", {
      action: `<strong>${actionMap[row[field]]}</strong>`,
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
      updateApi(row?.pk ?? row?.id, updateData)
        .then((res: BaseResult) => {
          if (res.code === 1000) {
            message(t("results.success"), { type: "success" });
          } else {
            message(`${t("results.failed")}，${res.detail}`, {
              type: "error"
            });
          }
          switchLoadMap.value[index] = Object.assign(
            {},
            switchLoadMap.value[index],
            {
              loading: false
            }
          );
        })
        .catch(e => {
          row[field] === false ? (row[field] = true) : (row[field] = false);
          switchLoadMap.value[index] = Object.assign(
            {},
            switchLoadMap.value[index],
            {
              loading: false
            }
          );
          throw e;
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
  msg?: string;
}

const renderSwitch = (switchOptions: switchOptions) => {
  const {
    t,
    switchLoadMap,
    switchStyle,
    updateApi,
    field,
    actionMap,
    msg = ""
  } = switchOptions;

  const defaultActionMap = {
    true: t("labels.enable"),
    false: t("labels.disable"),
    ...actionMap
  };

  return scope => (
    <el-switch
      size={scope.props.size === "small" ? "small" : "default"}
      loading={switchLoadMap.value[scope.index]?.loading}
      v-model={scope.row[field]}
      active-value={true}
      inactive-value={false}
      active-text={defaultActionMap["true"]}
      inactive-text={defaultActionMap["false"]}
      inline-prompt
      style={switchStyle.value}
      onChange={() =>
        onSwitchChange({
          t,
          msg,
          field,
          updateApi,
          switchLoadMap,
          row: scope.row,
          index: scope.index,
          actionMap: defaultActionMap
        })
      }
    />
  );
};

export { openFormDialog, handleOperation, onSwitchChange, renderSwitch };
export type {
  operationOptions,
  changeOptions,
  switchOptions,
  formDialogOptions
};
