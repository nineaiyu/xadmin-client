import { message } from "@/utils/message";
import { h, reactive, ref, type Ref, shallowRef } from "vue";
import { userNoticeReadApi } from "@/api/user/notice";
import { deviceDetection, getKeyList } from "@pureadmin/utils";
import { addDialog } from "@/components/ReDialog";
import { useI18n } from "vue-i18n";
import { useUserStoreHook } from "@/store/modules/user";

import { hasAuth } from "@/router/utils";
import type { CRUDColumn, OperationProps } from "@/components/RePlusCRUD";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import NoticeShowForm from "@/views/system/components/NoticeShow.vue";

import Success from "@iconify-icons/ep/success-filled";

export function useUserNotice(tableRef: Ref) {
  const { t } = useI18n();

  const api = reactive(userNoticeReadApi);

  const auth = reactive({
    list: hasAuth("list:userNotice"),
    detail: hasAuth("detail:userNoticeRead"),
    batchRead: hasAuth("update:userNoticeRead"),
    allRead: hasAuth("update:userNoticeReadAll")
  });

  const selectedNum = ref(0);
  const unreadCount = ref(0);
  const manySelectData = ref([]);

  function handleReadAll() {
    api.allRead().then(() => {
      tableRef.value.handleGetData();
    });
  }

  function handleManyRead() {
    if (selectedNum.value === 0) {
      message(t("results.noSelectedData"), { type: "error" });
      return;
    }
    api
      .batchRead({ pks: getKeyList(manySelectData.value, "pk") })
      .then(async res => {
        if (res.code === 1000) {
          message(t("results.batchRead", { count: selectedNum.value }), {
            type: "success"
          });
          tableRef.value.handleGetData();
        } else {
          message(`${t("results.failed")}，${res.detail}`, { type: "error" });
        }
      });
  }

  const showDialog = (row, routeParams = null, searchFields = null) => {
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
        if (routeParams?.pk) {
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

  const searchComplete = ({ routeParams, searchFields, dataList, res }) => {
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

  const selectionChange = data => {
    manySelectData.value = data;
    selectedNum.value = manySelectData.value.length ?? 0;
  };
  const listColumnsFormat = (columns: CRUDColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "title":
          column["cellRenderer"] = ({ row }) => (
            <el-text type={row.level?.value}>{row.title}</el-text>
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
            return t("buttons.batchDeleteConfirm", {
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
