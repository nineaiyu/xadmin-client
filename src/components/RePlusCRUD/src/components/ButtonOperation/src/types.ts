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
  text?:
    | string
    | Ref<string>
    | ComputedRef<string>
    | ((
        button: OperationButtonsRow
      ) => string | Ref<string> | ComputedRef<string>);
  code: string | number;
  index?: number;
  icon?: Component;
  props?:
    | ButtonRowProps
    | ((row: any, button: OperationButtonsRow) => ButtonRowProps)
    | ComputedRef<ButtonRowProps>;
  show?:
    | number
    | boolean
    | Ref<number | boolean>
    | ComputedRef<number | boolean>
    | ((
        button: OperationButtonsRow
      ) =>
        | number
        | boolean
        | Ref<number | boolean>
        | ComputedRef<number | boolean>);
  update?: boolean; // 用于判断是否是更新该按钮信息
  loading?: boolean;
  confirm?: {
    title?:
      | string
      | Ref<string>
      | ComputedRef<string>
      | ((
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
