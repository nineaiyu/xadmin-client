import { reactive, shallowRef, type Ref } from "vue";
import { noticeReadApi } from "@/api/system/notice";
import { usePageAuth } from "@/router/utils";
import { useI18n } from "vue-i18n";
import type { OperationProps } from "@/components/RePlusPage";
import { useNoticeReadColumns } from "./useNoticeReadColumns";
import { openNoticeReadDetail } from "./noticeReadDetail";

/**
 * 通知接收列表：列渲染与行内跳转见 useNoticeReadColumns.tsx，
 * 详情弹窗见 noticeReadDetail.ts，本文件负责数据源与操作列装配。
 */
export function useNoticeRead(tableRef: Ref) {
  const { t } = useI18n();

  const api = reactive(noticeReadApi);

  const auth = usePageAuth(["state"]);

  const { listColumnsFormat } = useNoticeReadColumns({
    t,
    api,
    auth,
    tableRef
  });

  const operationButtonsProps = shallowRef<OperationProps>({
    width: 140,
    buttons: [
      {
        code: "detail",
        onClick({ row }) {
          openNoticeReadDetail({ t, row });
        },
        update: true
      }
    ]
  });

  return {
    api,
    auth,
    listColumnsFormat,
    operationButtonsProps
  };
}
