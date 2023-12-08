import dayjs from "dayjs";
import { message } from "@/utils/message";
import type { PaginationProps } from "@pureadmin/table";
import {
  reactive,
  ref,
  h,
  onMounted,
  toRaw,
  type Ref,
  computed,
  Transition
} from "vue";
import {
  getFileListApi,
  updateFileApi,
  deleteFileApi,
  manyDeleteFileApi,
  getFileDownloadUrlApi,
  directDownloadUrl,
  syncFileInfoApi
} from "@/api/movies/file";
import { delay, formatBytes, getKeyList } from "@pureadmin/utils";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import type { FormItemProps } from "./types";
import { addDialog } from "@/components/ReDialog";
import EditPen from "@iconify-icons/ep/edit-pen";
import Check from "@iconify-icons/ep/check";
import previewForm from "../preview.vue";
import uploadForm from "../upload/src/index.vue";
export function useFile(tableRef: Ref) {
  const { t } = useI18n();
  const sortOptions = [
    {
      label: `${t("sorts.createdDate")} ${t("labels.descending")}`,
      key: "-created_time"
    },
    {
      label: `${t("sorts.createdDate")} ${t("labels.ascending")}`,
      key: "created_time"
    },

    {
      label: `${t("MoviesFile.size")} ${t("labels.descending")}`,
      key: "-size"
    },
    {
      label: `${t("MoviesFile.size")} ${t("labels.ascending")}`,
      key: "size"
    },

    {
      label: `${t("MoviesFile.downloads")} ${t("labels.descending")}`,
      key: "-downloads"
    },
    {
      label: `${t("MoviesFile.downloads")} ${t("labels.ascending")}`,
      key: "downloads"
    }
  ];
  const usedOptions = [
    {
      label: t("MoviesFile.used"),
      key: "true"
    },
    {
      label: t("MoviesFile.unused"),
      key: "false"
    }
  ];
  const form = reactive({
    name: "",
    drive_id: "",
    file_id: "",
    description: "",
    used: "",
    ordering: sortOptions[0].key,
    page: 1,
    size: 10
  });
  const manySelectCount = ref(0);
  const dataList = ref([]);
  const loading = ref(true);
  const pagination = reactive<PaginationProps>({
    total: 0,
    pageSize: 10,
    currentPage: 1,
    pageSizes: [5, 10, 20, 50, 100],
    background: true
  });
  const activeIndex = ref(-1);
  const inputValMap = ref({});
  const editStatus = ref({});
  const editing = computed(() => {
    return index => {
      return editStatus.value[index]?.editing;
    };
  });
  const comVal = computed(() => {
    return index => {
      return inputValMap.value[index]?.value;
    };
  });
  const iconClass = computed(() => {
    return (index, other = false) => {
      return [
        "cursor-pointer",
        "ml-2",
        "transition",
        "delay-100",
        other
          ? ["hover:scale-110", "hover:text-red-500"]
          : editing.value(index) && ["scale-150", "text-red-500"]
      ];
    };
  });
  const columns: TableColumnList = [
    {
      type: "selection",
      align: "left"
    },
    {
      label: t("labels.id"),
      prop: "pk",
      minWidth: 100
    },
    {
      label: t("MoviesDrive.driveId"),
      prop: "aliyun_drive",
      minWidth: 100
    },
    {
      label: t("MoviesFile.name"),
      prop: "name",
      minWidth: 200,
      cellRenderer: ({ row }) => <span v-copy={row.name}>{row.name}</span>
    },
    {
      label: t("MoviesFile.fileId"),
      prop: "file_id",
      minWidth: 200,
      cellRenderer: ({ row }) => <span v-copy={row.file_id}>{row.file_id}</span>
    },
    {
      label: t("MoviesFile.size"),
      prop: "size",
      minWidth: 100,
      cellRenderer: ({ row }) => <span>{formatBytes(row.size)}</span>
    },
    {
      label: t("MoviesFile.downloads"),
      prop: "downloads",
      minWidth: 100
    },
    {
      label: t("MoviesFile.duration"),
      prop: "duration",
      minWidth: 100
    },
    {
      label: t("labels.status"),
      prop: "used",
      minWidth: 100,
      cellRenderer: ({ row, props }) => (
        <el-tag
          size={props.size}
          type={row.used ? "success" : "warning"}
          effect="plain"
        >
          {row.used ? t("MoviesFile.used") : t("MoviesFile.unused")}
        </el-tag>
      )
    },
    {
      label: t("MoviesFile.isUpload"),
      prop: "is_upload",
      minWidth: 100,
      cellRenderer: ({ row, props }) => (
        <el-tag
          size={props.size}
          type={row.is_upload ? "success" : "warning"}
          effect="plain"
        >
          {row.is_upload
            ? t("MoviesFile.uploadFile")
            : t("MoviesFile.importFile")}
        </el-tag>
      )
    },
    {
      label: t("sorts.createdDate"),
      minWidth: 180,
      prop: "createTime",
      formatter: ({ created_time }) =>
        dayjs(created_time).format("YYYY-MM-DD HH:mm:ss")
    },
    {
      label: t("labels.remark"),
      minWidth: 100,
      prop: "description",
      cellRenderer: ({ row, index }) => (
        <div
          class="flex-bc w-full h-[32px]"
          onMouseenter={() => (activeIndex.value = index)}
          onMouseleave={() => onMouseleave(index)}
        >
          <p v-show={!editing.value(index)}>{row.description}</p>
          <Transition enter-active-class="animate__animated animate__fadeInUp animate__faster">
            <el-input
              v-show={editing.value(index)}
              modelValue={comVal.value(index)}
              onInput={value => onChange(value, index)}
            />
          </Transition>
          <iconify-icon-offline
            v-show={editing.value(index)}
            icon={Check}
            class={iconClass.value(index)}
            onClick={() => onSure(index)}
          />
          <iconify-icon-offline
            v-show={
              activeIndex.value === index &&
              !editing.value(index) &&
              hasAuth("update:MoviesFile")
            }
            icon={EditPen}
            class={iconClass.value(index, true)}
            onClick={() => onEdit(row, index)}
          />
        </div>
      )
    },
    {
      label: t("labels.operations"),
      fixed: "right",
      width: 180,
      slot: "operation"
    }
  ];

  function onEdit({ description }, index) {
    inputValMap.value[index] = Object.assign({}, inputValMap.value[index], {
      value: description
    });
    // 处于编辑状态
    editStatus.value[index] = Object.assign({}, editStatus.value[index], {
      editing: true
    });
  }

  function onMouseleave(index) {
    inputValMap.value[index]?.value
      ? (activeIndex.value = index)
      : (activeIndex.value = -1);
  }

  function onChange(value, index) {
    inputValMap.value[index].value = value;
  }

  function onSure(index) {
    dataList.value[index].description = inputValMap.value[index].value;
    updateFileApi(dataList.value[index].pk, {
      description: dataList.value[index].description
    }).then(res => {
      if (res.code === 1000) {
        message(t("results.success"), { type: "success" });
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });

    // 编辑状态关闭
    editStatus.value[index] = Object.assign({}, editStatus.value[index], {
      editing: false
    });
    delay().then(() => (inputValMap.value[index].value = null));
  }

  const buttonClass = computed(() => {
    return [
      "!h-[20px]",
      "reset-margin",
      "!text-gray-500",
      "dark:!text-white",
      "dark:hover:!text-primary"
    ];
  });
  function openDialog(row?: FormItemProps) {
    addDialog({
      title: `${t("MoviesFile.preview")} ${row.name}`,
      props: {
        formInline: {
          pk: row?.pk ?? "-1",
          name: row?.name ?? "",
          file_id: row?.file_id ?? "",
          autoplay: true
        }
      },
      width: "640px",
      draggable: true,
      fullscreenIcon: true,
      closeOnClickModal: false,
      closeOnPressEscape: false,
      hideFooter: true,
      contentRenderer: () => h(previewForm)
    });
  }

  function handelUpload() {
    addDialog({
      title: `${t("MoviesFile.upload")}`,
      props: {
        limit: 5,
        multiple: true
      },
      width: "50%",
      draggable: true,
      fullscreenIcon: true,
      closeOnClickModal: false,
      closeOnPressEscape: false,
      hideFooter: true,
      contentRenderer: () => h(uploadForm)
    });
  }

  async function handleDelete(row) {
    deleteFileApi(row.pk).then(async res => {
      if (res.code === 1000) {
        message(t("results.success"), { type: "success" });
        await onSearch();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  }

  function downloadFile(url) {
    const iframe = document.createElement("iframe", {});
    iframe.style.display = "none"; // 防止影响页面
    iframe.style.height = "0"; // 防止影响页面
    iframe.referrerPolicy = "no-referrer";
    iframe.src = url;
    document.body.appendChild(iframe);
    delay(5 * 60 * 1000).then(() => {
      iframe.remove();
    });
  }

  function syncFileInfo(row) {
    syncFileInfoApi(row.pk).then(res => {
      if (res.code === 1000) {
        message(t("results.success"), { type: "success" });
        onSearch();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  }

  function handleDownloadFile(row) {
    getFileDownloadUrlApi(row.pk).then((res: any) => {
      if (res.code === 1000) {
        downloadFile(res.download_url);
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  }

  async function handleSizeChange(val: number) {
    form.page = 1;
    form.size = val;
    await onSearch();
  }

  async function handleCurrentChange(val: number) {
    form.page = val;
    await onSearch();
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
      message(t("results.noSelectedData"), { type: "error" });
      return;
    }
    const manySelectData = tableRef.value.getTableRef().getSelectionRows();
    manyDeleteFileApi({
      pks: JSON.stringify(getKeyList(manySelectData, "pk"))
    }).then(async res => {
      if (res.code === 1000) {
        message(t("results.batchDelete", { count: manySelectCount.value }), {
          type: "success"
        });
        await onSearch();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  }

  async function onSearch(init = false) {
    if (init) {
      pagination.currentPage = form.page = 1;
      pagination.pageSize = form.size = 10;
    }
    loading.value = true;
    const { data } = await getFileListApi(toRaw(form));
    dataList.value = data.results;
    pagination.total = data.total;
    delay(500).then(() => {
      loading.value = false;
    });
  }

  const resetForm = formEl => {
    if (!formEl) return;
    formEl.resetFields();
    onSearch();
  };

  function makeDownloadUrl(file_info) {
    let base_url = import.meta.env.VITE_API_DOMAIN;
    if (base_url === "") {
      base_url = window.location.origin;
    }
    return `${base_url}${directDownloadUrl}${file_info.pk}/${file_info.file_id}/${file_info.name}`;
  }

  onMounted(() => {
    // 不带refer
    // document
    //   .querySelector('meta[name="referrer"]')
    //   .setAttribute("content", "never");

    onSearch();
  });

  return {
    t,
    form,
    loading,
    columns,
    dataList,
    pagination,
    buttonClass,
    sortOptions,
    usedOptions,
    manySelectCount,
    onSelectionCancel,
    onSearch,
    resetForm,
    openDialog,
    handelUpload,
    makeDownloadUrl,
    handleDelete,
    syncFileInfo,
    handleManyDelete,
    handleDownloadFile,
    handleSizeChange,
    handleCurrentChange,
    handleSelectionChange
  };
}
