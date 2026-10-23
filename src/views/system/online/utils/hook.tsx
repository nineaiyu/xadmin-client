import { userOnlineApi } from "@/api/identity/online";
import { useRouter } from "vue-router";
import { goUserDetail } from "@/views/system/hooks";
import { onActivated, onDeactivated, onMounted, onUnmounted } from "vue";
import { defineListPage, formatPageColumns } from "@/components/RePlusPage";
import { createOnlineButtons } from "./onlineButtons";
import { createOnlinePoller } from "./onlinePoller";

/** 在线会话行（按钮/列渲染使用的字段） */
type OnlineRow = {
  pk?: string | number;
  creator?: { username?: string; pk?: number | string };
};

/**
 * 在线会话页装配：行内/批量强制下线按钮见 onlineButtons.ts，
 * 本文件负责数据源、列渲染与行内跳转。
 */
export function useUserOnline() {
  const router = useRouter();

  const page = defineListPage({
    api: userOnlineApi,
    localeName: "systemOnline",
    extraAuth: ["forceLogout", "batchForceLogout"],
    columns: ({ columns }) =>
      formatPageColumns(columns, {
        creator: column => {
          column["cellRenderer"] = ({ row }) => (
            <el-link onClick={() => onGoDetail(row)}>
              {row.creator?.username ? row.creator?.username : "/"}
            </el-link>
          );
        }
      }),
    buttons: ({ t, api, auth, tableRef }) =>
      createOnlineButtons({
        t,
        api,
        tableRef,
        auth
      })
  });

  // 批量下线只保留页面自建入口（文案与语义一致）。框架默认「批量删除」走同一
  // batch-destroy 接口，确认文案却是「删除」，两条同效入口并存会误导操作者。
  page.auth.batchDestroy = false;

  // 自动刷新：30s 轮询当前页（页面隐藏时跳过；keep-alive 失活即停表）
  const poller = createOnlinePoller(() =>
    page.tableRef.value?.handleGetData?.()
  );
  onMounted(() => poller.start());
  onActivated(() => poller.start());
  onDeactivated(() => poller.stop());
  onUnmounted(() => poller.stop());

  /** 行内 `creator` 嵌套字段（点击跳转 SystemUser 详情） */
  function onGoDetail(row: OnlineRow) {
    goUserDetail(router, row?.creator?.pk);
  }

  return page;
}
