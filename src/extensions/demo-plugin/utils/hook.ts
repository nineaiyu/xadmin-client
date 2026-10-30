import { defineListPage } from "@/components/RePlusPage";
import { pluginNoteApi } from "./api";

/**
 * 插件示例页装配：**最小形态**——不传 columns / formOptions / buttons，
 * 列表列与表单字段全部来自后端 search-columns / search-fields 元数据
 * （`PluginNoteSerializer.table_fields`），实现「后端加模型 → 前端免写列定义」。
 *
 * 需要自定义渲染 / 按钮时，参照 `src/views/demo/book/utils/hook.tsx` 逐项加回。
 */
export function usePluginNote() {
  return defineListPage({ api: pluginNoteApi, localeName: "pluginNote" });
}
