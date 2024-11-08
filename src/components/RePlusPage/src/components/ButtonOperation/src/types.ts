import type { Component, ComputedRef, Ref } from "vue";
import type {
  ButtonProps,
  ElMessageBoxOptions,
  ElTooltipProps
} from "element-plus";
import type { Mutable } from "@vueuse/core";

export type ButtonRowProps = Partial<
  Mutable<ButtonProps & { [index: string]: any }>
>;

export interface OperationButtonsRow {
  /**
   * 操作文本
   */
  text?:
    | string
    | Ref<string>
    | ComputedRef<string>
    | ((
        row: any,
        button: OperationButtonsRow
      ) => string | Ref<string> | ComputedRef<string>);
  /**
   * 操作按钮唯一code，可用来判断按钮类型
   */
  code: string | number;
  /**
   * 按钮顺序，从左到右，从小到大， 受show影响
   */
  index?: number;
  /**
   * `@element-plus/icons-vue` 的图标名称，对ElButton,ElLink 和ElIcon 组件同时生效
   */
  icon?: Component;
  /**
   * ElButton 组件对应的props
   */
  props?:
    | ButtonRowProps
    | ((row: any, button: OperationButtonsRow) => ButtonRowProps)
    | ComputedRef<ButtonRowProps>;
  /**
   * 用于判断按钮是否显示
   */
  show?:
    | number
    | boolean
    | Ref<number | boolean>
    | ComputedRef<number | boolean>
    | ((
        row: any,
        button: OperationButtonsRow
      ) =>
        | number
        | boolean
        | Ref<number | boolean>
        | ComputedRef<number | boolean>);
  /**
   * 用于判断是否是更新该按钮信息，一般更新默认的编译，删除，查看按钮信息
   */
  update?: boolean;
  loading?: boolean;
  confirm?: {
    title?:
      | string
      | Ref<string>
      | ComputedRef<string>
      | ((
          row: any,
          button: OperationButtonsRow
        ) => string | Ref<string> | ComputedRef<string>);
    props?: ElMessageBoxOptions;
  };
  tooltip?: {
    content?:
      | string
      | Ref<string>
      | ComputedRef<string>
      | ((
          row: any,
          button: OperationButtonsRow
        ) => string | Ref<string> | ComputedRef<string>);
    props?: ElTooltipProps;
  };
  onClick?: (params: ButtonsCallBackParams) => void;
  _?: OperationButtonsRow;
}

export interface ButtonsCallBackParams {
  e: MouseEvent;
  row: object | any;
  loading: { value: boolean };
  buttonRow: OperationButtonsRow;
}

export interface OperationProps {
  width?: number;
  size?: "" | "default" | "small" | "large";
  row?: object;
  showNumber?: number;
  buttons?: OperationButtonsRow[];
}

export interface OperationEmits {
  (e: "clickAction", data: ButtonsCallBackParams): void;
}
