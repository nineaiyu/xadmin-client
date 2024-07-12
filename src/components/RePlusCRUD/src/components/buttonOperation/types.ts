import type { Component } from "vue";
import type {
  ButtonProps,
  ElMessageBoxOptions,
  ElTooltipProps
} from "element-plus";
import type { Mutable } from "@vueuse/core";

export interface OperationButtonsRow {
  text?: string;
  code?: string | number;
  icon?: Component;
  props?: Partial<Mutable<ButtonProps & { [index: string]: any }>>;
  show?: boolean;
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
interface ButtonsCallBackParams {
  buttonRow: OperationButtonsRow;
  row: object;
  e: MouseEvent;
}
export interface OperationProps {
  size?: "" | "default" | "small" | "large";
  row?: object;
  showNumber?: number;
  buttons?: OperationButtonsRow[];
}

export interface OperationEmits {
  (e: "clickAction", data: ButtonsCallBackParams): void;
}
