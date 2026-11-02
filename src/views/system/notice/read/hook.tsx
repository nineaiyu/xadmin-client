import { shallowRef } from "vue";
import { noticeReadApi } from "@/api/system/notice";
import { defineListPage, handleOperation } from "@/components/RePlusPage";
import type { OperationProps } from "@/components/RePlusPage";
import { useNoticeReadColumns } from "./useNoticeReadColumns";
import { openNoticeReadDetail } from "./noticeReadDetail";
import { canRemoveNoticeReadRow, type NoticeReadRow } from "./noticeReadRules";
import { createNoticeReadRemove } from "./noticeReadRemove";

/**
 * 通知接收列表：列渲染与行内跳转见 useNoticeReadColumns.tsx，
 * 详情弹窗见 noticeReadDetail.ts，本文件负责数据源与操作列装配。
 */
export function useNoticeRead() {
  const page = defineListPage({
    api: noticeReadApi,
    localeName: "noticeRead",
    extraAuth: ["state", "allRead"],
    buttons: ({ t, api, auth, tableRef }) => {
      // 能力位快照：本 hook 末尾会把 page.auth.destroy 关掉（避免框架默认
      // 「删除」入口与「移除」重叠），而函数型 show 逐次求值读实时值——
      // 不快照的话「移除」按钮恒不渲染（后端 Destroy 能力实际存在）
      const canDestroy = Boolean(auth.destroy);
      const removeNoticeRead = createNoticeReadRemove({ t, api, tableRef });

      const operationButtonsProps = shallowRef<OperationProps>({
        width: 200,
        buttons: [
          {
            code: "detail",
            onClick({ row }) {
              openNoticeReadDetail({ t, row });
            },
            update: true
          },
          {
            code: "remove",
            text: t("noticeRead.remove"),
            props: { type: "danger", link: true },
            show: row =>
              canRemoveNoticeReadRow(row as NoticeReadRow, canDestroy),
            onClick({ row }) {
              removeNoticeRead(row as NoticeReadRow);
            }
          }
        ]
      });

      const tableBarButtonsProps = shallowRef<OperationProps>({
        buttons: [
          {
            text: t("noticeRead.allRead"),
            code: "allRead",
            confirm: { title: t("noticeRead.allReadConfirm") },
            props: { type: "primary", plain: true },
            show: auth.allRead,
            onClick: ({ loading }) => {
              loading.value = true;
              handleOperation({
                t,
                apiReq: api.allRead(),
                success() {
                  tableRef.value?.handleGetData();
                },
                requestEnd() {
                  loading.value = false;
                }
              });
            }
          }
        ]
      });

      return {
        tableBarButtonsProps,
        operationButtonsProps
      };
    }
  });
  // 列渲染依赖 useRouter / usePublicHooks（内部有 inject 与 onBeforeMount），
  // 必须在 setup 同步执行；defineListPage 的 columns 回调延迟到列表元数据返回
  // 后才触发，放在里面会告警「no active component instance」。
  const { listColumnsFormat } = useNoticeReadColumns({
    t: page.t,
    api: page.api,
    auth: page.auth,
    tableRef: page.tableRef
  });
  // 默认删除/批量删除与「移除」语义重叠且确认文案是「删除」：
  // 关闭框架默认入口，只保留带明确确认的「移除」
  page.auth.destroy = false;
  page.auth.batchDestroy = false;
  return { ...page, listColumnsFormat };
}
