import { message } from "@/utils/message";
import {
  actionRankMenuApi,
  createMenuApi,
  deleteMenuApi,
  getMenuListApi,
  manyDeleteMenuApi,
  updateMenuApi
} from "@/api/system/menu";
import { reactive, ref, computed, onMounted, h } from "vue";
import { addDialog } from "@/components/ReDialog/index";
import editForm from "../edit.vue";
import { FormItemProps } from "./types";
import { handleTree } from "@/utils/tree";
import { cloneDeep } from "@pureadmin/utils";
import { getMenuFromPk, getMenuOrderPk } from "@/utils";
const sortOptions = [
  { label: "添加时间 Descending", key: "-created_time" },
  { label: "添加时间 Ascending", key: "created_time" }
];

const defaultData: FormItemProps = {
  menu_type: 0,
  parent: "",
  name: "",
  path: "",
  rank: 0,
  component: "",
  is_active: true,
  meta: {
    title: "",
    icon: "",
    r_svg_name: "",
    is_show_menu: true,
    is_show_parent: false,
    is_keepalive: false,
    frame_url: "",
    frame_loading: false,
    transition_enter: "",
    transition_leave: "",
    is_hidden_tag: false,
    dynamic_level: 0
  }
};

export function useMenu() {
  const form = reactive({
    username: "",
    mobile: "",
    is_active: "",
    ordering: sortOptions[0].key,
    page: 1,
    size: 10
  });
  const formRef = ref();
  const treeData = ref([]);
  const dataList = ref([]);
  const choicesDict = ref([]);
  const menuUrlList = ref([]);
  const menuData = reactive<FormItemProps>(cloneDeep(defaultData));
  const loading = ref(true);

  const buttonClass = computed(() => {
    return [
      "!h-[20px]",
      "reset-margin",
      "!text-gray-500",
      "dark:!text-white",
      "dark:hover:!text-primary"
    ];
  });

  const getMenuData = () => {
    loading.value = true;
    getMenuListApi({ page: 1, size: 100 }).then(res => {
      if (res.code === 1000) {
        treeData.value = handleTree(res.data);
        choicesDict.value = res.choices_dict;
        menuUrlList.value = res.api_url_list;
      }
      loading.value = false;
    });
  };

  async function handleDelete(row) {
    deleteMenuApi(row.pk).then(async res => {
      if (res.code === 1000) {
        message("操作成功", { type: "success" });
        getMenuData();
      } else {
        message(`操作失败，${res.detail}`, { type: "error" });
      }
    });
  }
  function handleManyDelete(val) {
    const manyPks = val!.getCheckedKeys(false);
    if (manyPks.length === 0) {
      message("数据未选择", { type: "error" });
      return;
    }
    manyDeleteMenuApi({ pks: JSON.stringify(manyPks) }).then(async res => {
      if (res.code === 1000) {
        message(`批量删除了${manyPks.length}条数据`, {
          type: "success"
        });
        getMenuData();
      } else {
        message(`操作失败，${res.detail}`, { type: "error" });
      }
    });
  }
  const resetForm = formEl => {
    if (!formEl) return;
    formEl.resetFields();
  };

  const handleConfirm = (formRef, row) => {
    formRef!.validate((isValid: boolean) => {
      if (isValid) {
        row.meta.title = row.title;
        if (row.pk) {
          updateMenuApi(row.pk, row).then(res => {
            if (res.code === 1000) {
              message(res.detail, { type: "success" });
              getMenuData();
            } else {
              message(res.detail, { type: "error" });
            }
          });
        }
      } else {
        message("表单校验失败", { type: "warning" });
      }
    });
  };
  function addNewMenu(treeRef, data: FormItemProps) {
    const p_menus = getMenuFromPk(treeRef?.data, data.pk);
    const row = cloneDeep(defaultData);
    if (p_menus.length > 0) {
      row.parent = p_menus[0].pk;
      row.parent_ids = p_menus.map(res => res.pk);
    } else {
      row.parent = "";
    }
    openDialog(0, row);
  }
  function openDialog(menu_type, row?: FormItemProps) {
    addDialog({
      title: "新增",
      props: {
        formInline: {
          pk: row?.pk ?? "",
          menu_type: menu_type,
          is_add: true,
          parent: row?.parent ?? "",
          parent_ids: row?.parent_ids ?? [],
          name: row?.name ?? "",
          path: row?.path ?? "",
          rank: row?.rank ?? 0,
          component: row?.component ?? "",
          is_active: row?.is_active ?? true,
          meta: {
            title: row?.meta.title ?? "",
            icon: row?.meta.icon ?? "",
            r_svg_name: row?.meta.r_svg_name ?? "",
            is_show_menu: row?.meta.is_show_menu ?? true,
            is_show_parent: row?.meta.is_show_parent ?? false,
            is_keepalive: row?.meta.is_keepalive ?? false,
            frame_url: row?.meta.frame_url ?? "",
            frame_loading: row?.meta.frame_loading ?? false,
            transition_enter: row?.meta.transition_enter ?? "",
            transition_leave: row?.meta.transition_leave ?? "",
            is_hidden_tag: row?.meta.is_hidden_tag ?? false,
            dynamic_level: row?.meta.dynamic_level ?? 0
          }
        }
      },
      width: "40%",
      draggable: true,
      fullscreenIcon: true,
      closeOnClickModal: false,
      contentRenderer: () => h(editForm, { ref: formRef }),
      beforeSure: (done, { options }) => {
        const FormRef = formRef.value.getRef();
        const curData = options.props.formInline as FormItemProps;
        async function chores() {
          message(`您新增了了节点名称为${curData.name}的这条数据`, {
            type: "success"
          });
          done(); // 关闭弹框
          getMenuData(); // 刷新表格数据
        }
        FormRef.validate(async valid => {
          if (valid) {
            curData.meta.title = curData.title;
            createMenuApi(curData).then(async res => {
              if (res.code === 1000) {
                await chores();
              } else {
                message(`操作失败，${res.detail}`, { type: "error" });
              }
            });
          }
        });
      }
    });
  }
  const handleDrag = (treeRef, node, node2, position) => {
    const u_menu = node.data;
    if (position === "inner") {
      u_menu.parent = node2.data.pk;
    } else {
      u_menu.parent = node2.data.parent;
    }
    updateMenuApi(u_menu.pk, u_menu).then((res: any) => {
      if (res.code === 1000) {
        actionRankMenuApi({
          action: "order",
          pks: getMenuOrderPk(treeRef.value?.data)
        })
          .then((res: any) => {
            if (res.code === 1000) {
              message(res.detail, { type: "success" });
            } else {
              message(res.detail, { type: "error" });
            }
          })
          .catch(err => {
            message(err.detail, { type: "error" });
          });
      } else {
        message(res.detail, { type: "error" });
      }
    });
  };
  onMounted(async () => {
    getMenuData();
  });

  return {
    form,
    loading,

    dataList,
    treeData,
    menuData,
    choicesDict,
    handleManyDelete,
    menuUrlList,
    addNewMenu,
    buttonClass,
    sortOptions,
    defaultData,
    getMenuData,
    handleDrag,
    openDialog,
    resetForm,
    handleConfirm,
    handleDelete
  };
}
