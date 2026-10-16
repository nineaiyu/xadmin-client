import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { userNoticeReadApi } from "@/api/user/notice";
import { useNoticeStoreHook } from "@/store/modules/notice";
import { reactive, ref, type Ref } from "vue";
import { getKeyList } from "@pureadmin/utils";
import { handleOperation } from "@/components/RePlusPage";
import { useUserNoticeColumns } from "./userNoticeColumns";
import { createUserNoticeDialog } from "./userNoticeDialog";
import { useUserNoticeButtons } from "./useUserNoticeButtons";
import type { RecordType } from "plus-pro-components";

/**
 * 我的通知装配：列渲染见 userNoticeColumns.tsx，详情弹窗（含深链 pk 消费）
 * 见 userNoticeDialog.ts，按钮见 useUserNoticeButtons.ts。
 */
export function useUserNotice(tableRef: Ref) {
  const { t } = useI18n();

  const api = reactive(userNoticeReadApi);

  const auth = reactive({
    list: hasAuth("list:UserNotice"),
    batchRead: hasAuth("batchRead:UserNotice"),
    allRead: hasAuth("allRead:UserNotice")
  });

  const selectedNum = ref(0);
  const unreadCount = ref(0);
  const manySelectData = ref<RecordType[]>([]);

  /** 统一走 handleOperation：成功/失败提示与业务码分支收口，失败不再静默 */
  function handleReadAll() {
    handleOperation({
      t,
      apiReq: api.allRead(),
      success: () => tableRef.value.handleGetData()
    });
  }

  function handleManyRead() {
    if (selectedNum.value === 0) {
      message(t("results.noSelectedData"), { type: "error" });
      return;
    }
    handleOperation({
      t,
      apiReq: api.batchRead({ pks: getKeyList(manySelectData.value, "pk") }),
      success: () => tableRef.value.handleGetData()
    });
  }

  const showDialog = createUserNoticeDialog({ t, api, tableRef });

  const searchComplete = ({
    routeParams,
    searchFields,
    dataList,
    res
  }: {
    routeParams: RecordType;
    searchFields: Ref<RecordType>;
    dataList: Ref<RecordType[]>;
    res: RecordType;
  }) => {
    unreadCount.value = res.unread_count;
    useNoticeStoreHook().SET_NOTICECOUNT(res.unread_count);
    if (
      routeParams.pk &&
      routeParams.pk === searchFields.value.pk &&
      routeParams.pk !== "" &&
      dataList.value.length > 0
    ) {
      showDialog(dataList.value[0], routeParams, searchFields);
    }
  };

  const selectionChange = (data: RecordType[]) => {
    manySelectData.value = data;
    selectedNum.value = manySelectData.value.length ?? 0;
  };

  const { listColumnsFormat } = useUserNoticeColumns({ t });

  const { tableBarButtonsProps, operationButtonsProps } = useUserNoticeButtons({
    t,
    auth,
    selectedNum,
    unreadCount,
    onManyRead: handleManyRead,
    onReadAll: handleReadAll,
    openDetail: row => showDialog(row)
  });

  return {
    api,
    auth,
    listColumnsFormat,
    operationButtonsProps,
    tableBarButtonsProps,
    selectionChange,
    searchComplete
  };
}
