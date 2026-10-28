import {
  addDialog,
  type ArgsType,
  type DialogOptions
} from "@/components/ReDialog/index";
import { uniqueArrayObj } from "./index";
import type { ExposedFormInstance } from "./types";
import { deviceDetection } from "@pureadmin/utils";
import { cloneDeep } from "lodash-es";
import { message } from "@/utils/message";
import { h, nextTick, ref, type Component, type Ref } from "vue";
import { scrollToFirstError } from "@/hooks/useFormScrollToError";
import { stripHiddenFormFields } from "./hiddenFormFields";
import type { PlusFormProps, RecordType } from "plus-pro-components";
import type { SearchColumnsResult, SearchFieldsResult } from "@/api/types";
import AddOrEdit from "../components/AddOrEdit.vue";
import { addDrawer, type DrawerOptions } from "@/components/ReDrawer/index";
import { dialogSize } from "@/components/ReDialog/size";

const modeFuncMap = {
  drawer: addDrawer,
  dialog: addDialog
} satisfies {
  [key in "dialog" | "drawer"]: (
    options: Partial<DrawerOptions & DialogOptions>
  ) => void;
};

/**
 * 取列解析器的上下文列表：
 * - 元数据已下发该键 → 使用装配好的列（页面在其上就地微调）；
 * - 元数据未下发（如资源授权编辑器这类「独立端点 + 专属控件」的扩展字段）
 *   → 提供一个只有 `prop` / `_column.key` 的空列，页面解析器可自行建立
 *   `valueType` / `renderField` / `label` / `fieldProps` 并作为新增表单字段注入。
 *
 * 扩展字段同样进入 `uniqueArrayObj([...rawColumns, ...editColumns], "prop")` 的合并，
 * 因此会出现在元数据字段之后（提交载荷与普通字段同通道，无需额外契约）。
 */
export function resolveFormColumn(
  rawColumnsMap: Record<string, RawColumn>,
  key: string
): EditableColumn {
  return (
    (rawColumnsMap[key] as EditableColumn | undefined) ?? {
      prop: key,
      _column: { key }
    }
  );
}

/**
 * 合并表单 props：元数据生成的 `rules`（必填/类型校验）与页面补充的 `rules`
 * （跨字段校验、扩展字段必填）按字段**合并**而不是整块覆盖。
 *
 * 页面经 `addOrEditOptions.formProps` 只声明自己关心的字段时，不能把框架按
 * 元数据生成的校验规则丢掉（否则 name/url 等必填只剩红点、提交打到后端才报错）。
 */
export function mergeFormProps(
  rawFormProps?: Record<string, unknown>,
  formPropsResult?: Record<string, unknown>
): Record<string, unknown> {
  const merged: Record<string, unknown> = {
    ...(rawFormProps ?? {}),
    ...(formPropsResult ?? {})
  };
  if (rawFormProps?.rules || formPropsResult?.rules) {
    merged.rules = {
      ...((rawFormProps?.rules as Record<string, unknown>) ?? {}),
      ...((formPropsResult?.rules as Record<string, unknown>) ?? {})
    };
  }
  return merged;
}

/** 导入/导出弹窗统一宽度（两弹窗视觉对称，取 md 档） */
export const EXPORT_IMPORT_DIALOG_WIDTH = dialogSize("md");

/**
 * 新增/编辑表单弹层默认宽度：md(640) / lg(760) 对两列表单仍偏窄（标签 + 控件易被压缩），
 * 默认取 xxl(960)；页面需要更宽/更窄时经 `dialogDrawerOptions.width` 显式覆盖。
 */
export const DEFAULT_FORM_DIALOG_WIDTH = dialogSize("xxl");

/** 弹层宽度解析：页面显式配置优先，未配置时取表单默认档位。 */
export function resolveFormDialogWidth(options?: { width?: string }): string {
  return options?.width ?? DEFAULT_FORM_DIALOG_WIDTH;
}

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
  /** 分页签表单：切到指定页签（服务端校验错误定位用） */
  setActiveName?: (index: number) => void;
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

/**
 * 表单列属性表：键值可为静态列对象或解析器（解析器上下文附带当前列 `column`）。
 * 解析器可返回 `undefined` 表示「该列不参与表单」——元数据未下发该键（如只读列被
 * 框架过滤后不在表单列集合内）时页面无需额外判空，直接放弃该列即可。
 */
type ColumnSpec = {
  [key: string]:
    | RawColumn
    | ((
        formOptions: Partial<formDialogDrawerOptions> & {
          column: EditableColumn;
        }
      ) => RawColumn | undefined);
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

export interface formDialogDrawerOptions {
  mode?: "dialog" | "drawer";
  t: (arg0: string, arg1?: object) => string;
  isAdd?: boolean;
  /** 外部处理方法：键值可为静态值或按表单上下文求值的解析器 */
  row?: DynamicSpec;
  /** 弹窗的title */
  title: string;
  /** 确定按钮文案覆盖（默认 buttons.save） */
  sureBtnText?: string;
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
  }) => RecordType | undefined | Promise<RecordType | undefined>;
  /** 点击保存回调 */
  saveCallback?: (args: callBackArgs) => void;
}

/** 挂载在弹层内的表单组件需暴露的实例契约（AddOrEdit / ExportData / ImportData 均实现） */
export interface DialogFormInstance {
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

export const openDialogDrawer = (formOptions: formDialogDrawerOptions) => {
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
    const rawKey = column._column?.key ?? column.prop;
    if (rawKey) rawColumnsMap[rawKey] = column;
  });
  const editColumns: Record<string, RawColumn> = {};
  Object.keys(formOptions?.columns ?? {}).forEach(key => {
    const getValue = formOptions.columns?.[key];
    if (typeof getValue === "function") {
      try {
        const resolved = getValue({
          ...cloneDeep({
            ...formOptions,
            column: resolveFormColumn(rawColumnsMap, key)
          }),
          formValue: formOptions.formValue
        });
        // 解析器返回空值表示「该列不参与表单」（键不在表单列集合内时的默认口径），
        // 此时不注入，避免把无 prop 的空列塞进表单
        if (resolved) editColumns[key] = resolved;
      } catch (err) {
        console.warn(err);
      }
    } else if (getValue) {
      editColumns[key] = getValue;
    }
  });

  const formPropsResult = resolveSpec(formOptions.formProps, formOptions);
  const tabsPropsResult = resolveSpec(formOptions.tabsProps, formOptions);

  const clientWidth = document.documentElement.clientWidth;
  const minWidth = Number((formOptions.minWidth ?? "600px").replace("px", ""));
  const width = resolveFormDialogWidth(formOptions?.dialogDrawerOptions);
  let numberWidth: number;
  if (width.endsWith("%") || width.endsWith("vw")) {
    numberWidth =
      (clientWidth * Number(width.replace("%", "").replace("vw", ""))) / 100;
  } else {
    numberWidth = Number(width.replace("px", ""));
  }
  // 小屏回退：视口不足 minWidth（含两侧留白）时按 90vw 展示，避免弹窗横向溢出、
  // 关闭按钮不可点；移动端仍由 fullscreen 覆盖（见下方 fullscreen 配置）
  const isNarrowScreen = clientWidth < minWidth + 32;
  const finalWidth = isNarrowScreen
    ? Math.max(Math.round(clientWidth * 0.9), 320)
    : Math.max(minWidth, numberWidth);
  // dialog/drawer 打开器是两个重载函数，联合后会失去可调用性（各自参数类型不兼容）；
  // 此处不启用载荷通道，按二者共有的选项签名收口调用
  const func = (modeFuncMap[formOptions.mode ?? "dialog"] ?? addDialog) as (
    options: Partial<DrawerOptions & DialogOptions>
  ) => void;
  func({
    title: formOptions.title,
    props: {
      formInline,
      ...propsResult,
      columns: uniqueArrayObj(
        [...(formOptions?.rawColumns ?? []), ...Object.values(editColumns)],
        "prop"
      ),
      formProps: mergeFormProps(
        formOptions?.rawFormProps,
        formPropsResult
      ) as PlusFormProps,
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
      const FormRef = formRef.value?.getRef();
      if (!FormRef) {
        // 内容组件尚未就绪（极端时序）：收口 loading 直接返回，避免保存按钮卡死
        closeLoading();
        return;
      }
      const allFormInstances = FormRef?._allInstances ?? [FormRef]; // 获取所有 PlusForm 实例
      const formInlineData = cloneDeep(options.props?.formInline ?? {});

      const success = (detail?: string, close: boolean = true) => {
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
        const instance = allFormInstances[i];
        const valid = await instance?.validate(valid => {
          if (!valid) {
            formRef.value?.setActiveName?.(i);
            closeLoading();
          }
        });
        if (!valid) {
          // 错误定位：先等页签切换渲染（上方回调）再滚动到首个错误字段并聚焦；
          // EP 内置 scrollToError 发生在切页签之前，对未激活页签的滚动不可见
          await nextTick();
          scrollToFirstError(instance);
          return;
        }
      }
      const submitted = formOptions?.beforeSubmit
        ? await formOptions.beforeSubmit({
            formData: formInlineData,
            formRef: formRef,
            formOptions
          })
        : undefined;
      // 隐藏列（含联动 computed）在提交前剔除：后端 PATCH 语义是「未提交键保留」，
      // 否则用户把字段隐藏后旧值仍会被写回，表现为「字段消失但值没清」
      const formData = stripHiddenFormFields(
        (submitted as RecordType | undefined) || formInlineData,
        formOptions?.columns
      );
      formOptions?.saveCallback?.({
        formData,
        formRef: FormRef,
        closeLoading,
        formOptions,
        success,
        failed,
        done,
        // 服务端校验错误定位：分页签表单需切到错误所在页签
        setActiveName: (index: number) => formRef.value?.setActiveName?.(index)
      });
    },
    ...formOptions?.dialogDrawerOptions,
    width: `${finalWidth}px`,
    size: `${finalWidth}`,
    onChange(data) {
      // 内容组件 change 透传：AddOrEdit 载荷为 { values, column }
      const payload = data?.values as
        { values?: RecordType; column?: unknown } | undefined;
      if (payload?.values && formOptions.formValue) {
        formOptions.formValue.value = payload.values;
      }
      if (formOptions?.dialogDrawerOptions?.onChange) {
        formOptions?.dialogDrawerOptions?.onChange(data);
      }
    }
  } as Partial<DrawerOptions & DialogOptions>);
};
