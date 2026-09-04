import {
  builtinSearchRenderers,
  searchFallbackRenderer
} from "./renderers-search";
import { builtinFormRenderers, formFallbackRenderer } from "./renderers-form";
import { builtinDetailRenderers } from "./renderers-detail";
import type { PlusColumnHandler, PlusColumnRegistry } from "./types";

/**
 * 列渲染器注册表。
 *
 * 内置渲染器按 input_type 查找；业务侧可通过 register*Renderer 注册自定义
 * input_type 的渲染器，或覆盖内置行为。注册为模块级全局生效，需在页面首次
 * 渲染（getColumnData）之前调用。
 */
const searchRenderers: PlusColumnRegistry = { ...builtinSearchRenderers };
const formRenderers: PlusColumnRegistry = { ...builtinFormRenderers };
const detailRenderers: PlusColumnRegistry = { ...builtinDetailRenderers };

/** 注册/覆盖搜索列渲染器 */
export function registerSearchRenderer(
  inputType: string,
  handler: PlusColumnHandler
) {
  searchRenderers[inputType] = handler;
}

/** 注册/覆盖表单列（新增/编辑）渲染器 */
export function registerFormRenderer(
  inputType: string,
  handler: PlusColumnHandler
) {
  formRenderers[inputType] = handler;
}

/** 注册/覆盖详情/表格列渲染器 */
export function registerDetailRenderer(
  inputType: string,
  handler: PlusColumnHandler
) {
  detailRenderers[inputType] = handler;
}

/** 获取搜索列渲染器，无匹配时回退到 default 分支行为 */
export function getSearchRenderer(inputType: string): PlusColumnHandler {
  return searchRenderers[inputType] ?? searchFallbackRenderer;
}

/** 获取表单列渲染器，无匹配时回退到 default 分支行为 */
export function getFormRenderer(inputType: string): PlusColumnHandler {
  return formRenderers[inputType] ?? formFallbackRenderer;
}

/** 获取详情/表格列渲染器，无匹配时返回 undefined（不配置，与原行为一致） */
export function getDetailRenderer(
  inputType: string
): PlusColumnHandler | undefined {
  return detailRenderers[inputType];
}
