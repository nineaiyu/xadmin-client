import { transformI18n } from "@/plugins/i18n";

/**
 * 菜单标题展示文本。
 *
 * 内置种子菜单的 `meta.title` 存的是词条 key（如 `menus.sysManagement`），
 * 预览各展示块（菜单树 / 字段矩阵 / 绑定菜单 / 试算上下文）统一经此转换，
 * 与侧栏菜单保持同一语言；普通中文标题原样返回。
 */
export const translateMenuTitle = (title?: string): string =>
  transformI18n(title ?? "");
