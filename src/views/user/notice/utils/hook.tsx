import dayjs from "dayjs";
import { message } from "@/utils/message";
import { type PaginationProps } from "@pureadmin/table";
import { reactive, ref, h, onMounted, toRaw, type Ref } from "vue";
import {
  getUserNoticeListApi,
  updateUserNoticeReadApi,
  updateUserNoticeReadAllApi
} from "@/api/system/notice";
import { useRoute } from "vue-router";
import { FormItemProps } from "./types";
import showForm from "../show.vue";
import { cloneDeep, getKeyList, isEmpty, isString } from "@pureadmin/utils";
import { addDialog } from "@/components/ReDialog/index";

const sortOptions = [
  { label: "添加时间 Descending", key: "-created_time" },
  { label: "添加时间 Ascending", key: "created_time" }
];

export function useUserNotice(tableRef: Ref) {
  const form = reactive({
    pk: "",
    title: "",
    message: "",
    level: "",
    notice_type: "",
    unread: "",
    ordering: sortOptions[0].key,
    page: 1,
    size: 10
  });
  const route = useRoute();
  const getParameter = isEmpty(route.params) ? route.query : route.params;
  const formRef = ref();
  const manySelectCount = ref(0);
  const unreadCount = ref(0);
  const dataList = ref([]);
  const loading = ref(true);
  const levelChoices = ref([]);
  const noticeChoices = ref([]);
  const pagination = reactive<PaginationProps>({
    total: 0,
    pageSize: 10,
    currentPage: 1,
    pageSizes: [5, 10, 20, 50, 100],
    background: true
  });
  const columns: TableColumnList = [
    {
      type: "selection",
      align: "left"
    },
    {
      label: "消息ID",
      prop: "pk",
      minWidth: 100
    },
    {
      label: "消息标题",
      prop: "title",
      minWidth: 120,
      cellRenderer: ({ row }) => <el-text type={row.level}>{row.title}</el-text>
    },
    {
      label: "是否已读",
      prop: "unread",
      minWidth: 120,
      cellRenderer: ({ row }) => (
        <el-text type={row.unread ? "success" : "info"}>
          {row.unread ? "未读" : "已读"}
        </el-text>
      )
    },
    {
      label: "提交时间",
      minWidth: 180,
      prop: "createTime",
      formatter: ({ created_time }) =>
        dayjs(created_time).format("YYYY-MM-DD HH:mm:ss")
    },
    {
      label: "消息类型",
      prop: "notice_type_display",
      minWidth: 120
    },
    {
      label: "操作",
      fixed: "right",
      width: 200,
      slot: "operation"
    }
  ];

  function showDialog(row?: FormItemProps) {
    if (row.unread) {
      updateUserNoticeReadApi({ pks: [row.pk] });
    }
    addDialog({
      title: `查看用户消息`,
      props: {
        formInline: {
          pk: row?.pk ?? "",
          title: row?.title ?? "",
          message: row?.message ?? "",
          level: row?.level ?? "",
          levelChoices: levelChoices.value,
          noticeChoices: noticeChoices.value
        }
      },
      width: "70%",
      draggable: true,
      fullscreenIcon: true,
      closeOnClickModal: false,
      contentRenderer: () => h(showForm, { ref: formRef }),
      closeCallBack: () => {
        if (getParameter.pk) {
          form.pk = "";
        }
        if (row.unread) {
          form.pk = "";
          onSearch();
        }
      }
    });
  }

  async function handleSizeChange(val: number) {
    form.page = 1;
    form.size = val;
    onSearch();
  }

  async function handleCurrentChange(val: number) {
    form.page = val;
    onSearch();
  }

  function handleSelectionChange(val) {
    manySelectCount.value = val.length;
  }

  function onSelectionCancel() {
    manySelectCount.value = 0;
    // 用于多选表格，清空用户的选择
    tableRef.value.getTableRef().clearSelection();
  }

  function handleReadAll() {
    updateUserNoticeReadAllApi().then(() => {
      onSearch();
    });
  }

  function handleManyRead() {
    if (manySelectCount.value === 0) {
      message("数据未选择", { type: "error" });
      return;
    }
    const manySelectData = tableRef.value.getTableRef().getSelectionRows();
    updateUserNoticeReadApi({
      pks: getKeyList(
        manySelectData.filter(r => {
          return r.unread;
        }),
        "pk"
      )
    }).then(async res => {
      if (res.code === 1000) {
        message(`批量已读了${manySelectCount.value}条数据`, {
          type: "success"
        });
        onSearch();
      } else {
        message(`操作失败，${res.detail}`, { type: "error" });
      }
    });
  }

  function onSearch(init = false) {
    if (init) {
      pagination.currentPage = form.page = 1;
      pagination.pageSize = form.size = 10;
    }
    loading.value = true;
    getUserNoticeListApi(toRaw(form)).then(res => {
      if (res.code === 1000 && res.data) {
        dataList.value = res.data.results;
        pagination.total = res.data.total;
        levelChoices.value = res.level_choices;
        noticeChoices.value = res.notice_type_choices;
        unreadCount.value = res.unread_count;
      } else {
        message(`操作失败，${res.detail}`, { type: "error" });
      }
      setTimeout(() => {
        loading.value = false;
        if (
          getParameter.pk &&
          getParameter.pk === form.pk &&
          getParameter.pk !== "" &&
          dataList.value.length > 0
        ) {
          showDialog(dataList.value[0]);
        }
      }, 500);
    });
  }

  const resetForm = formEl => {
    if (!formEl) return;
    formEl.resetFields();
    onSearch();
  };

  onMounted(() => {
    if (getParameter) {
      const parameter = cloneDeep(getParameter);
      Object.keys(parameter).forEach(param => {
        if (!isString(parameter[param])) {
          parameter[param] = parameter[param].toString();
        }
      });
      form.pk = parameter.pk;
    }
    onSearch();
  });

  return {
    form,
    loading,
    columns,
    dataList,
    pagination,
    sortOptions,
    unreadCount,
    manySelectCount,
    levelChoices,
    noticeChoices,
    onSelectionCancel,
    onSearch,
    resetForm,
    showDialog,
    handleManyRead,
    handleReadAll,
    handleSizeChange,
    handleCurrentChange,
    handleSelectionChange
  };
}
