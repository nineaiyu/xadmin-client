import dayjs from "dayjs";
import { message } from "@/utils/message";
import { type PaginationProps } from "@pureadmin/table";
import { reactive, ref, h, onMounted, toRaw, type Ref } from "vue";
import {
  deleteAnnouncementReadApi,
  getAnnouncementReadListApi,
  manyDeleteAnnouncementReadApi
} from "@/api/system/announcement";
import { FormItemProps } from "../utils/types";
import showForm from "../show.vue";
import { getKeyList } from "@pureadmin/utils";
import { addDialog } from "@/components/ReDialog/index";
import { useRouter } from "vue-router";
const sortOptions = [
  { label: "添加时间 Descending", key: "-created_time" },
  { label: "添加时间 Ascending", key: "created_time" }
];
export function useAnnouncementRead(tableRef: Ref) {
  const form = reactive({
    title: "",
    message: "",
    username: "",
    owner_id: "",
    announcement_id: "",
    ordering: sortOptions[0].key,
    page: 1,
    size: 10
  });
  const formRef = ref();
  const router = useRouter();
  const manySelectCount = ref(0);
  const dataList = ref([]);
  const loading = ref(true);
  const choicesDict = ref([]);
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
      label: "公告ID",
      prop: "pk",
      minWidth: 100,
      cellRenderer: ({ row }) => <el-text>{row.announcement.pk}</el-text>
    },
    {
      label: "公告标题",
      prop: "title",
      minWidth: 120,
      cellRenderer: ({ row }) => (
        <el-link
          type={row.announcement.level}
          onClick={() => onGoAnnouncementDetail(row as any)}
        >
          {row.announcement.title}
        </el-link>
      )
    },
    {
      label: "已读用户ID",
      prop: "owner",
      minWidth: 100,
      cellRenderer: ({ row }) => <el-text>{row.owner_info.pk}</el-text>
    },
    {
      label: "已读用户信息",
      prop: "owner",
      minWidth: 100,
      cellRenderer: ({ row }) => (
        <el-link onClick={() => onGoUserDetail(row as any)}>
          {row.owner_info.username ? row.owner_info.username : "/"}
        </el-link>
      )
    },
    {
      label: "用户已读时间",
      minWidth: 180,
      prop: "createTime",
      formatter: ({ created_time }) =>
        dayjs(created_time).format("YYYY-MM-DD HH:mm:ss")
    },
    {
      label: "操作",
      fixed: "right",
      width: 200,
      slot: "operation"
    }
  ];
  function onGoUserDetail(row: any) {
    if (row.owner_info && row.owner_info.pk) {
      router.push({
        name: "systemUser",
        query: { pk: row.owner_info.pk }
      });
    }
  }
  function onGoAnnouncementDetail(row: any) {
    if (row.announcement && row.announcement.pk) {
      router.push({
        name: "systemAnnouncement",
        query: { pk: row.announcement.pk }
      });
    }
  }
  function showDialog(row?: FormItemProps) {
    addDialog({
      title: `查看系统公告`,
      props: {
        formInline: {
          pk: row?.pk ?? "",
          title: row?.title ?? "",
          message: row?.message ?? "",
          publish: row?.publish ?? true,
          level: row?.level ?? "",
          choicesDict: choicesDict.value
        }
      },
      width: "70%",
      draggable: true,
      fullscreenIcon: true,
      closeOnClickModal: false,
      contentRenderer: () => h(showForm, { ref: formRef })
    });
  }

  async function handleDelete(row) {
    deleteAnnouncementReadApi(row.pk).then(async res => {
      if (res.code === 1000) {
        message("操作成功", { type: "success" });
        onSearch();
      } else {
        message(`操作失败，${res.detail}`, { type: "error" });
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
  function handleManyDelete() {
    if (manySelectCount.value === 0) {
      message("数据未选择", { type: "error" });
      return;
    }
    const manySelectData = tableRef.value.getTableRef().getSelectionRows();
    manyDeleteAnnouncementReadApi({
      pks: JSON.stringify(getKeyList(manySelectData, "pk"))
    }).then(async res => {
      if (res.code === 1000) {
        message(`批量删除了${manySelectCount.value}条数据`, {
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
    getAnnouncementReadListApi(toRaw(form)).then(res => {
      if (res.code === 1000 && res.data) {
        dataList.value = res.data.results;
        pagination.total = res.data.total;
        choicesDict.value = res.choices_dict;
      } else {
        message(`操作失败，${res.detail}`, { type: "error" });
      }
      loading.value = false;
    });
  }

  const resetForm = formEl => {
    if (!formEl) return;
    formEl.resetFields();
    onSearch();
  };

  onMounted(() => {
    onSearch();
  });

  return {
    form,
    loading,
    columns,
    dataList,
    pagination,
    sortOptions,
    manySelectCount,
    choicesDict,
    onSelectionCancel,
    onSearch,
    resetForm,
    showDialog,
    handleDelete,
    handleManyDelete,
    handleSizeChange,
    handleCurrentChange,
    handleSelectionChange
  };
}
