import { h, reactive, shallowRef, type Ref } from "vue";
import { noticeApi } from "@/api/system/notice";
import { deviceDetection } from "@pureadmin/utils";
import { addDialog } from "@/components/ReDialog";
import { usePageAuth } from "@/router/utils";
import { useI18n } from "vue-i18n";
import { NoticeChoices } from "@/views/system/constants";
import type { OperationProps } from "@/components/RePlusPage";
import NoticeShowForm from "@/views/system/components/NoticeShow.vue";
import type { RecordType } from "plus-pro-components";
import { useNoticeFormOptions } from "./useNoticeFormOptions";
import { useNoticeListColumns } from "./useNoticeListColumns";
import { parseNoticeUserParam } from "./noticeFormRules";

export function useNotice(tableRef: Ref) {
  const { t } = useI18n();

  const api = reactive(noticeApi);

  const auth = usePageAuth(["publish"]);

  const operationButtonsProps = shallowRef<OperationProps>(
    buildOperationButtons(t)
  );

  // 列表列渲染（标题/发布开关/已读人数）
  const { listColumnsFormat } = useNoticeListColumns({ t, api, auth });

  // 新增/编辑弹窗列装配与公告接口分流
  const { addOrEditOptions } = useNoticeFormOptions({ api });

  const searchComplete = ({
    routeParams,
    searchFields
  }: {
    routeParams: RecordType;
    searchFields: Ref<RecordType>;
  }) => {
    if (
      routeParams.notice_user &&
      searchFields.value.notice_user &&
      searchFields.value.notice_user !== ""
    ) {
      // 参数来自 URL（可被手工篡改或外链传错）：非法 JSON 直接清理并中止，
      // 避免解析异常中断 searchComplete 导致弹窗不再出现
      const parsed = parseNoticeUserParam(routeParams.notice_user);
      if (!parsed.ok) {
        searchFields.value.notice_user = "";
        return;
      }
      const row = {
        notice_user: parsed.value,
        notice_type: { value: NoticeChoices.USER }
      };
      searchFields.value.notice_user = "";
      tableRef.value.handleAddOrEdit(true, row);
    }
  };

  return {
    api,
    auth,
    addOrEditOptions,
    listColumnsFormat,
    operationButtonsProps,
    searchComplete
  };
}

/** 行操作：编辑按钮按通知类型禁用（通知公告走公告发布接口）+ 「查看公告」弹窗 */
function buildOperationButtons(
  t: ReturnType<typeof useI18n>["t"]
): OperationProps {
  return {
    width: 200,
    buttons: [
      {
        code: "update",
        // update:true 意味着我要更新这个按钮部分信息到默认的按钮信息，只更新props这个信息
        update: true,
        props: (row, button) => {
          const disabled = row?.notice_type?.value === NoticeChoices.SYSTEM;
          return {
            ...(button?._?.props ?? {}), // button?._ 这个表示之前老的按钮信息
            ...{ disabled, type: disabled ? "default" : "primary" }
          };
        }
      },
      {
        code: "detail",
        onClick({ row }) {
          addDialog({
            title: t("systemNotice.showSystemNotice"),
            props: {
              formInline: { ...row },
              hasPublish: true
            },
            width: "60%",
            draggable: true,
            fullscreen: deviceDetection(),
            fullscreenIcon: true,
            closeOnClickModal: false,
            hideFooter: true,
            contentRenderer: () => h(NoticeShowForm)
          });
        },
        update: true
      }
    ]
  };
}
