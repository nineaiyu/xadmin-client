import { shallowRef } from "vue";
import type { noticeApi } from "@/api/system/notice";
import { hasAuth } from "@/router/utils";
import { NoticeChoices } from "@/views/system/constants";
import type { RePlusPageProps } from "@/components/RePlusPage";
import { buildNoticeFormColumns } from "./noticeColumns";
import type { RecordType } from "plus-pro-components";

type NoticeApiLike = Pick<typeof noticeApi, "announcement">;

/**
 * 通知公告新增/编辑弹窗装配。
 * 自 useNotice 拆出（行为不变）：列解析器见 noticeColumns.tsx，本文件负责
 * 弹层形态与公告接口分流（apiReq）。
 */
export function useNoticeFormOptions({ api }: { api: NoticeApiLike }) {
  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      columns: buildNoticeFormColumns(),
      minWidth: "600px",
      dialogDrawerOptions: {
        top: "10vh",
        width: "60vw"
      }
    },
    apiReq: ({ isAdd, formData }) => {
      if (isAdd) {
        if (
          (formData?.notice_type as RecordType)?.value ===
            NoticeChoices.NOTICE &&
          hasAuth("announcement:SystemNotice")
        ) {
          return api.announcement(formData);
        }
      }
    }
  });

  return {
    addOrEditOptions
  };
}
