import { shallowRef } from "vue";
import { tagApi } from "@/api/system/tag";
import { defineListPage, type OperationProps } from "@/components/RePlusPage";
import { useTagColumns } from "./tagColumns";
import { useTagFormOptions } from "./useTagFormOptions";
import { canDeleteTag } from "./tagDeleteGuard";

/**
 * 标签中心表格：标签 CRUD + 使用计数 + 删除保护提示。
 *
 * - 新建/编辑走框架元数据表单（name/color/remark 即后端字段），页面只在
 *   `useTagFormOptions` 里替换颜色预设色板；
 * - 删除保留框架默认入口（自带二次确认）；内置标签与使用中标签前端隐藏入口，
 *   后端仍保留拒绝兜底（并发引用/绕过 UI 的调用）；
 * - 颜色列的色块 tag 渲染见 tagColumns.tsx。
 */
export function useTags() {
  return defineListPage({
    api: tagApi,
    localeName: "tag",
    // 菜单权限码是 `*:Tag`（历史命名），不能按组件名 SystemTag 推导
    authSuffix: "Tag",
    columns: ({ t, columns }) =>
      useTagColumns({ t }).listColumnsFormat(columns),
    formOptions: () => useTagFormOptions().addOrEditOptions,
    // 覆盖默认删除按钮：内置标签与已被引用的标签点删除必然失败，直接隐藏；
    // 后端 tag destroy 仍保留内置/引用保护，防止并发引用或绕过 UI 的调用。
    buttons: ({ auth }) => ({
      operationButtonsProps: shallowRef<OperationProps>({
        buttons: [
          {
            code: "delete",
            update: true,
            show: row => canDeleteTag(row, Boolean(auth.destroy))
          }
        ]
      })
    })
  });
}
