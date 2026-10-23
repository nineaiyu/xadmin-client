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
    // 列格式化必须走工厂的 columns 选项：buttons 回调只透传按钮属性，
    // 在其中返回 listColumnsFormat 会被丢弃，导致 notice_info 退回 JSON 渲染。
    columns: ({ t, api, auth, tableRef, columns }) => {
      const { listColumnsFormat } = useNoticeReadColumns({
        t,
        api,
        auth,
        tableRef
      });
      return listColumnsFormat(columns);
    },
    buttons: ({ t, api, auth, tableRef }) => {
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
              canRemoveNoticeReadRow(
                row as NoticeReadRow,
                Boolean(auth.destroy)
              ),
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
  // 默认删除/批量删除与「移除」语义重叠且确认文案是「删除」：
  // 关闭框架默认入口，只保留带明确确认的「移除」
  page.auth.destroy = false;
  page.auth.batchDestroy = false;
  return page;
}
