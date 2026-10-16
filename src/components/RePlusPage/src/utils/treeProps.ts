/**
 * pure-table 的 treeProps 形态收口。
 *
 * 其 default 字面量类型要求三字段全必填；模板层对 setup ref 的类型展开会
 * 丢失 `checkStrictly`，经由此处显式签名传递。
 */
import type { Ref } from "vue";

export interface TreePropsShape {
  hasChildren: string;
  children: string;
  checkStrictly: boolean;
}

export function resolveTreeProps(
  treeProps: Ref<TreePropsShape>
): TreePropsShape {
  return treeProps.value;
}
