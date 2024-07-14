import type { Component } from "vue";
import type {
  ButtonProps,
  ElMessageBoxOptions,
  ElTooltipProps
} from "element-plus";
import type { Mutable } from "@vueuse/core";

export interface OperationButtonsRow {
  text?: string;
  code: string | number;
  icon?: Component;
  props?: Partial<Mutable<ButtonProps & { [index: string]: any }>>;
  show?: boolean;
  loading?: boolean;
  confirm?: {
    title?: string;
    props?: ElMessageBoxOptions;
  };
  tooltip?: {
    content?: string;
    props?: ElTooltipProps;
  };
  onClick?: (params: ButtonsCallBackParams) => void;
}
export interface ButtonsCallBackParams {
  e: MouseEvent;
  row: object;
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
