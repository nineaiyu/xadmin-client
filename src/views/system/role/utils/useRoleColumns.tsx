import { h } from "vue";
import { ElLink, ElTag } from "element-plus";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import {
  formatPageColumns,
  type PageTableColumn
} from "@/components/RePlusPage";

/**
 * 角色列表列渲染（自 hook.tsx 抽出）：
 * 「用户数」列（后端关联计数）可点击，跳转到按该角色筛选的用户列表
 * （用户页读取 ?role=<pk> 注入搜索条件，见 system/user/utils/hook.tsx）。
 */
export function useRoleColumns() {
  const router = useRouter();
  const { t } = useI18n();

  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      // 内置角色标记：布尔列默认会被框架渲染成可切换开关（内置角色不可停用），
      // 这里改为只读标签，避免「点了没反应/报错」的误导性交互。
      builtin: column => {
        column["width"] = 90;
        column["cellRenderer"] = ({ row }) =>
          row.builtin
            ? h(ElTag, { type: "info", size: "small" }, () =>
                t("systemRole.builtin")
              )
            : "-";
      },
      user_count: column => {
        column["minWidth"] = 90;
        // 跳转需用户列表权限：无权限时退化为纯文本（此前恒渲染链接，点击被 403 拦，
        // 与 dept 页 user_count 跳转的判定口径对齐）
        if (!hasAuth("list:SystemUser")) {
          column["cellRenderer"] = ({ row }) => String(row.user_count ?? 0);
          return;
        }
        column["cellRenderer"] = ({ row }) =>
          h(
            ElLink,
            {
              type: "primary",
              underline: "never",
              onClick: () =>
                router.push({
                  path: "/system/user/index",
                  query: { role: String(row.pk) }
                })
            },
            () => String(row.user_count ?? 0)
          );
      }
    });

  return { listColumnsFormat };
}
