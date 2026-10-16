import { useRouter } from "vue-router";
import { hasAuth } from "@/router/utils";
import {
  type PageTableColumn,
  formatPageColumns
} from "@/components/RePlusPage";
import type { DeptRow } from "./types";

/** 部门列表列渲染（人数跳转 / 名称列宽）；自 utils/hook 拆出，行为不变 */
export function useDeptColumns() {
  const router = useRouter();

  function onGoDetail(row: DeptRow) {
    if (hasAuth("list:SystemUser") && row.user_count && row.pk) {
      router.push({
        name: "SystemUser",
        query: { dept: row.pk }
      });
    }
  }

  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      user_count: column => {
        column["cellRenderer"] = ({ row }) => {
          // 无「用户列表」权限或人数为 0 时不可跳转：渲染为纯文本，
          // 避免出现可点却无反应（也无提示）的假链接
          const canJump = hasAuth("list:SystemUser") && row.user_count > 0;
          if (!canJump) return <span>{row.user_count}</span>;
          return (
            <el-link onClick={() => onGoDetail(row)}>{row.user_count}</el-link>
          );
        };
      },
      name: column => {
        column["minWidth"] = 200;
        column["align"] = "left";
      }
    });

  return { listColumnsFormat, onGoDetail };
}
