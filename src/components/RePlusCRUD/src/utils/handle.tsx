import { addDialog, type DialogOptions } from "@/components/ReDialog/index";
import { deviceDetection } from "@pureadmin/utils";
import { type Component, h, ref } from "vue";
import { cloneDeep } from "lodash-es";
import { message } from "@/utils/message";
import addOrEdit from "../components/addOrEdit.vue";
import type { PlusColumn, PlusFormProps } from "plus-pro-components";
import type { FormInstance } from "element-plus";

export const formatPublicLabels = (
  t: Function,
  te: Function,
  label: string,
  localeName: string
): string => {
  const formatLabel = `${localeName}.${label}`;
  if (te(formatLabel)) {
    return t(formatLabel);
  }
  if (label.split(".").length > 1) {
    if (te(`${localeName}.${label.split(".")[0]}`)) {
      return t(`${localeName}.${label.split(".")[0]}`);
    }
  }
  if (
    [
      "pk",
      "id",
      "ordering",
      "selection",
      "operation",
      "descending",
      "ascending"
    ].indexOf(label) > -1
  ) {
    return t(`commonLabels.${label}`);
  }
  return t(formatLabel);
};

interface localInfo {
  t: Function | any;
  te: Function | any;
  localeName?: string; // 国际化的名字
}

interface callBackArgs {
  formData: Object | any;
  formRef: FormInstance;
  formOptions: formOptions;
  success: (close?: boolean) => void;
  failed: (detail: string, close?: boolean) => void;
  done: Function;
}

interface formOptions {
  row: Function | Object; //  默认数据或者更新的书籍
  title: string; // 弹窗的的title
  columns?: Function | PlusColumn[] | Array<any>; // 表单字段
  localInfo?: localInfo; // 表单字段
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

const openDialog = (formOptions: formOptions) => {
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
  editColumns?.forEach(column => {
    column.label =
      column.label ??
      formatPublicLabels(
        formOptions?.localInfo?.t,
        formOptions?.localInfo?.te,
        column.prop as string,
        formOptions?.localInfo?.localeName
      );
  });

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
        message(formOptions?.localInfo?.t("results.success"), {
          type: "success"
        });
        close && done(); // 关闭弹框
      };

      const failed = (detail: string, close = false) => {
        message(`${formOptions?.localInfo?.t("results.failed")}，${detail}`, {
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

export { openDialog };
