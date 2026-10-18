import { reactive } from "vue";
import { useI18n } from "vue-i18n";
import { usePageAuth } from "@/router/utils";
import { tagApi } from "@/api/system/tag";
import { useTagColumns } from "./tagColumns";
import { useTagFormOptions } from "./useTagFormOptions";

/**
 * 标签中心表格：标签 CRUD + 使用计数 + 删除保护提示。
 *
 * - 新建/编辑走框架元数据表单（name/color/remark 即后端字段），页面只在
 *   `useTagFormOptions` 里替换颜色预设色板；
 * - 删除保留框架默认入口（自带二次确认）；被引用的标签由后端拒绝并给出可读文案；
 * - 颜色列的色块 tag 渲染见 tagColumns.tsx。
 */
export function useTags() {
  const { t } = useI18n();
  const api = reactive(tagApi);
  const auth = usePageAuth("Tag");

  const { listColumnsFormat } = useTagColumns({ t });
  const { addOrEditOptions } = useTagFormOptions();

  return { api, auth, addOrEditOptions, listColumnsFormat };
}
