import { useI18n } from "vue-i18n";
import { userOnlineApi } from "@/api/identity/online";
import { useRouter } from "vue-router";
import { usePageAuth } from "@/router/utils";
import { goUserDetail } from "@/views/system/hooks";
import { reactive, type Ref } from "vue";
import {
  formatPageColumns,
  type PageTableColumn
} from "@/components/RePlusPage";
import { createOnlineButtons } from "./onlineButtons";

/** 在线会话行（按钮/列渲染使用的字段） */
type OnlineRow = {
  pk?: string | number;
  creator?: { username?: string; pk?: number | string };
};

/**
 * 在线会话页装配：行内/批量强制下线按钮见 onlineButtons.ts，
 * 本文件负责数据源、列渲染与行内跳转。
 */
export function useUserOnline(tableRef: Ref) {
  const { t } = useI18n();
  const api = reactive(userOnlineApi);

  const auth = usePageAuth(["forceLogout", "batchForceLogout"]);

  const router = useRouter();
  const { operationButtonsProps, tableBarButtonsProps } = createOnlineButtons({
    t,
    api,
    tableRef,
    auth
  });

  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      creator: column => {
        column["cellRenderer"] = ({ row }) => (
          <el-link onClick={() => onGoDetail(row)}>
            {row.creator?.username ? row.creator?.username : "/"}
          </el-link>
        );
      }
    });

  /** 行内 `creator` 嵌套字段（点击跳转 SystemUser 详情） */
  function onGoDetail(row: OnlineRow) {
    goUserDetail(router, row?.creator?.pk);
  }

  return {
    api,
    auth,
    listColumnsFormat,
    tableBarButtonsProps,
    operationButtonsProps
  };
}
