import dayjs from "dayjs";
import { message } from "@/utils/message";
import { h, reactive, ref, type Ref } from "vue";
import { userNoticeReadApi } from "@/api/user/notice";
import { useRoute } from "vue-router";
import type { FormItemProps } from "./types";
import showForm from "../show.vue";
import { deviceDetection, isEmpty } from "@pureadmin/utils";
import { addDialog } from "@/components/ReDialog";
import { useI18n } from "vue-i18n";
import { useUserStoreHook } from "@/store/modules/user";

import { hasAuth } from "@/router/utils";

export function useUserNotice(tableRef: Ref) {
  const { t } = useI18n();

  const api = reactive({
    list: userNoticeReadApi.list,
    detail: userNoticeReadApi.detail,
    batchRead: userNoticeReadApi.batchRead,
    fields: userNoticeReadApi.fields,
    allRead: userNoticeReadApi.allRead
  });

  const auth = reactive({
    list: hasAuth("list:userNotice"),
    detail: hasAuth("detail:userNoticeRead"),
    batchRead: hasAuth("update:userNoticeRead"),
    fields: hasAuth("fields:userNoticeRead"),
    allRead: hasAuth("update:userNoticeReadAll")
  });

  const route = useRoute();
  const getParameter = isEmpty(route.params) ? route.query : route.params;
  const formRef = ref();
  const selectedNum = ref(0);
  const unreadCount = ref(0);
  const manySelectData = ref([]);

  const columns = ref<TableColumnList>([
    {
      type: "selection",
      fixed: "left",
      reserveSelection: true
    },
    {
      prop: "pk",
      minWidth: 100
    },
    {
      prop: "title",
      minWidth: 120,
      cellRenderer: ({ row }) => <el-text type={row.level}>{row.title}</el-text>
    },
    {
      prop: "unread",
      minWidth: 120,
      cellRenderer: ({ row }) => (
        <el-text type={row.unread ? "success" : "info"}>
          {row.unread ? t("labels.unread") : t("labels.read")}
        </el-text>
      )
    },
    {
      minWidth: 180,
      prop: "created_time",
      formatter: ({ created_time }) =>
        dayjs(created_time).format("YYYY-MM-DD HH:mm:ss")
    },
    {
      prop: "notice_type_display",
      minWidth: 120
    },
    {
      fixed: "right",
      width: 200,
      slot: "operation"
    }
  ]);

  function showDialog(row?: FormItemProps) {
    if (row.unread) {
      api.batchRead({ pks: [row.pk] });
    }
    addDialog({
      title: t("userNotice.showSystemNotice"),
      props: {
        formInline: {
          pk: row?.pk ?? "",
          title: row?.title ?? "",
          message: row?.message ?? "",
          level: row?.level ?? ""
        }
      },
      width: "70%",
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      hideFooter: true,
      contentRenderer: () => h(showForm, { ref: formRef }),
      closeCallBack: () => {
        if (getParameter.pk) {
          tableRef.value.searchFields.pk = "";
        }
        if (row.unread) {
          tableRef.value.searchFields.pk = "";
          tableRef.value.onSearch();
        }
      }
    });
  }

  function handleReadAll() {
    api.allRead().then(() => {
      tableRef.value.onSearch();
    });
  }

  function handleManyRead() {
    if (selectedNum.value === 0) {
      message(t("results.noSelectedData"), { type: "error" });
      return;
    }
    api.batchRead({ pks: manySelectData.value }).then(async res => {
      if (res.code === 1000) {
        message(t("results.batchRead", { count: selectedNum.value }), {
          type: "success"
        });
        tableRef.value.onSearch();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  }

  const searchEnd = (getParameter, form, dataList, res) => {
    unreadCount.value = res.unread_count;
    useUserStoreHook().SET_NOTICECOUNT(res.unread_count);
    if (
      getParameter.pk &&
      getParameter.pk === form.value.pk &&
      getParameter.pk !== "" &&
      dataList.value.length > 0
    ) {
      showDialog(dataList.value[0]);
    }
  };
  const selectionChange = func => {
    manySelectData.value = func();
    selectedNum.value = manySelectData.value.length ?? 0;
  };

  return {
    t,
    api,
    auth,
    columns,
    selectedNum,
    unreadCount,
    showDialog,
    searchEnd,
    handleReadAll,
    handleManyRead,
    selectionChange
  };
}
