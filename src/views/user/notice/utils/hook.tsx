import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { addDialog } from "@/components/ReDialog";
import { userNoticeReadApi } from "@/api/user/notice";
import { useUserStoreHook } from "@/store/modules/user";
import { h, reactive, ref, type Ref, shallowRef } from "vue";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { deviceDetection, getKeyList } from "@pureadmin/utils";
import NoticeShowForm from "@/views/system/components/NoticeShow.vue";
import {
  handleOperation,
  type OperationProps,
  type PageTableColumn
} from "@/components/RePlusPage";
import type { RecordType } from "plus-pro-components";

import Success from "~icons/ep/success-filled";

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

  const showDialog = (
    row: RecordType,
    routeParams: RecordType | null = null,
    searchFields: Ref<RecordType> | null = null
  ) => {
    if (row.unread) {
      api.batchRead({ pks: [row.pk] });
    }
    addDialog({
      title: t("userNotice.showSystemNotice"),
      props: {
        formInline: { ...row },
        hasPublish: false
      },
      width: "70%",
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      hideFooter: true,
      contentRenderer: () => h(NoticeShowForm),
      closeCallBack: () => {
        if (routeParams?.pk && searchFields) {
          searchFields.value.pk = "";
        }
        if (row.unread) {
          if (searchFields) {
            searchFields.value.pk = "";
          }
          tableRef.value.handleGetData();
        }
      }
    });
  };

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
    useUserStoreHook().SET_NOTICECOUNT(res.unread_count);
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
  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "title":
          // 字典驱动（notice_level）：字典色优先（el-text style），无色回退
          // 枚举值即 el-text 类型的契约
          column["cellRenderer"] = ({ row }) => (
            <el-text
              type={row.level?.value}
              style={row.level?.color ? { color: row.level.color } : undefined}
            >
              {row.title}
            </el-text>
          );
          break;
        case "unread":
          column["cellRenderer"] = ({ row }) => (
            <el-text type={row.unread ? "success" : "info"}>
              {row.unread ? t("labels.unread") : t("labels.read")}
            </el-text>
          );
          break;
      }
    });
    return columns;
  };

  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("userNotice.batchRead"),
        code: "batchRead",
        props: {
          type: "success",
          icon: useRenderIcon(Success),
          plain: true
        },
        onClick: () => {
          handleManyRead();
        },
        confirm: {
          title: () => {
            // 批量已读用独立文案：复用删除确认会误导（"确定批量删除 N 条数据吗？"）
            return t("userNotice.batchReadConfirm", {
              count: selectedNum.value
            });
          }
        },
        show: () => {
          return Boolean(auth.batchRead && selectedNum.value);
        }
      },
      {
        text: t("userNotice.allRead"),
        code: "allRead",
        props: {
          type: "primary"
        },
        onClick: () => {
          handleReadAll();
        },
        show: () => {
          return Boolean(auth.allRead && unreadCount.value > 0);
        }
      }
    ]
  });

  const operationButtonsProps = shallowRef<OperationProps>({
    width: 100,
    buttons: [
      {
        code: "detail",
        text: t("buttons.detail"),
        onClick({ row }) {
          showDialog(row);
        },
        update: true
      }
    ]
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
