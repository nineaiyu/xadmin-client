import { message } from "@/utils/message";
import { menuApi } from "@/api/system/menu";
import { h, onMounted, reactive, ref } from "vue";
import { addDialog } from "@/components/ReDialog";
import editForm from "../edit.vue";
import type { FormItemProps } from "./types";
import { handleTree } from "@/utils/tree";
import { cloneDeep, deviceDetection } from "@pureadmin/utils";
import { getMenuFromPk, getMenuOrderPk } from "@/utils";
import { useI18n } from "vue-i18n";
import { FieldChoices, MenuChoices } from "@/views/system/constants";
import { hasAuth, hasGlobalAuth } from "@/router/utils";
import { modelLabelFieldApi } from "@/api/system/field";

const defaultData: FormItemProps = {
  menu_type: MenuChoices.DIRECTORY,
  parent: "",
  name: "",
  path: "",
  rank: 0,
  component: "",
  method: "",
  model: [],
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
    fixed_tag: false,
    dynamic_level: 0
  }
};

export function useApiAuth() {
  const api = reactive({
    list: menuApi.list,
    rank: menuApi.rank,
    create: menuApi.create,
    delete: menuApi.delete,
    update: menuApi.patch,
    apiUrl: menuApi.apiUrl,
    choices: menuApi.choices,
    fields: menuApi.fields,
    permissions: menuApi.permissions,
    batchDelete: menuApi.batchDelete
  });

  const auth = reactive({
    list: hasAuth("list:systemMenu"),
    rank: hasAuth("rank:systemMenu"),
    create: hasAuth("create:systemMenu"),
    delete: hasAuth("delete:systemMenu"),
    update: hasAuth("update:systemMenu"),
    permissions: hasAuth("permissions:systemMenu"),
    choices: hasAuth("choices:systemMenu"),
    fields: hasAuth("fields:systemMenu"),
    apiUrl: hasAuth("apiUrl:systemMenu"),
    batchDelete: hasAuth("batchDelete:systemMenu")
  });
  return {
    api,
    auth
  };
}

export function useMenu() {
  const { t } = useI18n();
  const { api, auth } = useApiAuth();
  const formRef = ref();
  const treeData = ref([]);
  const parentIds = ref([]);
  const choicesDict = ref([]);
  const menuUrlList = ref([]);
  const modelList = ref([]);
  const menuData = reactive<FormItemProps>(cloneDeep(defaultData));
  const loading = ref(true);

  const getMenuApiList = () => {
    if (auth.apiUrl) {
      api.apiUrl().then(res => {
        if (res.code === 1000) {
          menuUrlList.value = res.data;
        }
      });
    }

    api.choices().then(res => {
      if (res.code === 1000) {
        choicesDict.value = res.choices_dict;
      }
    });
  };

  const getMenuData = () => {
    loading.value = true;
    api.list({ page: 1, size: 1000 }).then(res => {
      if (res.code === 1000) {
        treeData.value = handleTree(res.data.results);
      }
      loading.value = false;
    });
  };

  function handleDelete(row) {
    api.delete(row.pk).then(res => {
      if (res.code === 1000) {
        message(t("results.success"), { type: "success" });
        getMenuData();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  }

  function handleManyDelete(val) {
    const manyPks = val!.getCheckedKeys(false);
    if (manyPks.length === 0) {
      message(t("results.noSelectedData"), { type: "error" });
      return;
    }
    api.batchDelete(manyPks).then(res => {
      if (res.code === 1000) {
        message(t("results.batchDelete", { count: manyPks.length }), {
          type: "success"
        });
        getMenuData();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  }

  const handleConfirm = (formRef, row) => {
    formRef!.validate((isValid: boolean) => {
      if (isValid) {
        row.meta.title = row.title;
        if (row.pk) {
          api.update(row.pk, row).then(res => {
            if (res.code === 1000) {
              message(res.detail, { type: "success" });
              getMenuData();
            } else {
              message(res.detail, { type: "error" });
            }
          });
        }
      } else {
        message(t("results.formValidationFailed"), { type: "warning" });
      }
    });
  };

  function addNewMenu(treeRef, data: FormItemProps) {
    const p_menus = getMenuFromPk(treeRef?.data, data.pk);
    const row = cloneDeep(defaultData);
    if (p_menus.length > 0) {
      row.parent = p_menus[0].pk;
      row.parent_ids = p_menus.map(res => res.pk);
      parentIds.value = row.parent_ids;
    } else {
      row.parent = "";
    }
    openDialog(MenuChoices.DIRECTORY, row);
  }

  function openDialog(menu_type: number, row?: FormItemProps) {
    addDialog({
      title: t("buttons.add"),
      props: {
        treeData: treeData,
        methodChoices: choicesDict.value["method"],
        menuChoices: choicesDict.value["menu_type"],
        modelList: modelList,
        menuUrlList: menuUrlList,
        formInline: {
          pk: row?.pk ?? "",
          menu_type: menu_type,
          isAdd: true,
          parent: row?.parent ?? "",
          parent_ids: row?.parent_ids ?? [],
          name: row?.name ?? "",
          path: row?.path ?? "",
          method: row?.method ?? "",
          rank: row?.rank ?? 0,
          component: row?.component ?? "",
          model: row?.model ?? [],
          is_active: row?.is_active ?? true,
          meta: {
            title: row?.meta.title ?? "",
            icon: row?.meta.icon ?? "",
            frame_url: row?.meta.frame_url ?? "",
            r_svg_name: row?.meta.r_svg_name ?? "",
            is_show_menu: row?.meta.is_show_menu ?? true,
            is_show_parent: row?.meta.is_show_parent ?? false,
            is_keepalive: row?.meta.is_keepalive ?? false,
            frame_loading: row?.meta.frame_loading ?? false,
            transition_enter: row?.meta.transition_enter ?? "",
            transition_leave: row?.meta.transition_leave ?? "",
            is_hidden_tag: row?.meta.is_hidden_tag ?? false,
            fixed_tag: row?.meta.fixed_tag ?? false,
            dynamic_level: row?.meta.dynamic_level ?? 0
          }
        }
      },
      width: "40%",
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      contentRenderer: () => h(editForm, { ref: formRef }),
      beforeSure: (done, { options }) => {
        const FormRef = formRef.value.getRef();
        const curData = options.props.formInline as FormItemProps;
        FormRef.validate(valid => {
          if (valid) {
            curData.meta.title = curData.title;
            api.create(curData).then(res => {
              if (res.code === 1000) {
                message(t("results.success"), { type: "success" });
                done(); // 关闭弹框
                getMenuData(); // 刷新表格数据
              } else {
                message(`${t("results.failed")}，${res.detail}`, {
                  type: "error"
                });
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
    api.update(u_menu.pk, u_menu).then((res: any) => {
      if (res.code === 1000) {
        api
          .rank({ pks: getMenuOrderPk(treeRef.value?.data) })
          .then(res => {
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
  onMounted(() => {
    getMenuApiList();
    getMenuData();
    if (hasGlobalAuth("list:systemModelField")) {
      modelLabelFieldApi
        .list({
          page: 1,
          size: 1000,
          parent: 0,
          field_type: FieldChoices.ROLE
        })
        .then(res => {
          if (res.code === 1000) {
            modelList.value = res.data.results;
          }
        });
    }
  });

  return {
    auth,
    treeData,
    menuData,
    modelList,
    parentIds,
    choicesDict,
    menuUrlList,
    defaultData,
    addNewMenu,
    handleDrag,
    openDialog,
    getMenuData,
    handleDelete,
    handleConfirm,
    handleManyDelete
  };
}
