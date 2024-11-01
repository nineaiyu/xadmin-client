import { message } from "@/utils/message";
import { menuApi } from "@/api/system/menu";
import { computed, getCurrentInstance, h, onMounted, reactive, ref } from "vue";
import { addDialog } from "@/components/ReDialog";
import editForm from "../components/edit.vue";
import type { FormItemProps } from "./types";
import { handleTree } from "@/utils/tree";
import {
  cloneDeep,
  deviceDetection,
  isEmpty,
  isNullOrUnDef,
  isObject
} from "@pureadmin/utils";
import { getMenuFromPk, getMenuOrderPk } from "@/utils";
import { useI18n } from "vue-i18n";
import { FieldChoices, MenuChoices } from "@/views/system/constants";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import { modelLabelFieldApi } from "@/api/system/field";
import {
  handleExportData,
  handleImportData,
  handleOperation,
  openFormDialog,
  renderBooleanSegmentedOption
} from "@/components/RePlusPage";
import { formatFiledAppParent } from "@/views/system/hooks";
import type { PlusColumn } from "plus-pro-components";
import { ElInput } from "element-plus";

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
    is_keepalive: true,
    frame_url: "",
    frame_loading: false,
    transition_enter: "",
    transition_leave: "",
    is_hidden_tag: false,
    fixed_tag: false,
    dynamic_level: 0
  }
};

export function useMenu() {
  const { t } = useI18n();
  const api = reactive(menuApi);
  const auth = reactive({
    rank: false,
    permissions: false,
    apiUrl: false,
    ...getDefaultAuths(getCurrentInstance(), ["rank", "permissions", "apiUrl"])
  });
  const formRef = ref();
  const treeData = ref([]);
  const parentIds = ref([]);
  const choicesDict = ref([]);
  const menuUrlList = ref([]);
  const viewList = ref({});
  const modelList = ref([]);
  const menuData = ref<FormItemProps>(cloneDeep(defaultData));
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
        const results = res.data.results;
        results.forEach(item => {
          item.menu_type = item.menu_type?.value ?? item.menu_type;
          item.parent = item.parent?.pk ?? item.parent;
        });
        treeData.value = handleTree(results);
      }
      loading.value = false;
    });
  };

  const handleDelete = row => {
    api.destroy(row.pk).then(res => {
      if (res.code === 1000) {
        message(t("results.success"), { type: "success" });
        getMenuData();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  };

  const handleManyDelete = val => {
    const manyPks = val!.getCheckedKeys(false);
    if (manyPks.length === 0) {
      message(t("results.noSelectedData"), { type: "error" });
      return;
    }
    api.batchDestroy(manyPks).then(res => {
      if (res.code === 1000) {
        message(t("results.batchDestroy", { count: manyPks.length }), {
          type: "success"
        });
        getMenuData();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  };

  const handleConfirm = (instance, row) => {
    instance!.validate((isValid: boolean) => {
      if (isValid) {
        row.meta.title = row.title;
        if (row.pk) {
          api.partialUpdate(row.pk, row).then(res => {
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

  const addNewMenu = (treeRef, data: FormItemProps) => {
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
  };

  const openDialog = (menu_type: number, row?: FormItemProps) => {
    addDialog({
      title: t("buttons.add"),
      props: {
        treeData: treeData,
        methodChoices: choicesDict.value["method"],
        menuChoices: choicesDict.value["menu_type"],
        modelList: modelList,
        menuUrlList: menuUrlList,
        viewList: viewList,
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
            is_keepalive: row?.meta.is_keepalive ?? true,
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
        const FormRef = formRef.value?.getRef();
        const curData = options.props.formInline as FormItemProps;
        FormRef?.validate(valid => {
          if (valid) {
            curData.meta.title = curData.title;
            // 当后端pk 不设置可读时，需要删除pk，否则后端会提示 pk 不对
            delete curData.pk;
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
  };

  const handleDrag = (treeRef, node, node2, position) => {
    const u_menu = node.data;
    if (position === "inner") {
      u_menu.parent = node2.data.pk;
    } else {
      u_menu.parent = node2.data.parent;
    }
    api.partialUpdate(u_menu.pk, u_menu).then((res: any) => {
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

  const exportData = val => {
    const pks = val!.getCheckedKeys(false);
    handleExportData({ t, pks, api, allowTypes: ["selected", "all"] });
  };

  // 数据导入
  const importData = () => {
    handleImportData({
      t,
      api,
      success: () => {
        getMenuData();
      }
    });
  };

  const getViews = () => {
    const files: any = import.meta.glob("@/views/**/*.vue");
    Object.keys(files).forEach((file: string) => {
      // 忽略 components 目录的文件，规定该目录下的文件为依赖组件，而不是页面组件
      if (!/\/components\//.test(file)) {
        files[file]().then(data => {
          if (
            isEmpty(data?.default?.name) ||
            isNullOrUnDef(data?.default?.name)
          ) {
            return;
          }
          viewList.value[
            file.replace(/(\.\/|\.vue)/g, "").replace("/src/views/", "")
          ] = data?.default?.name;
        });
      }
    });
  };

  const handleAddPermissions = row => {
    row.skip_existing = true;
    const columns = ref<PlusColumn[]>([
      {
        label: t("systemMenu.menu"),
        prop: "meta.title",
        renderField: value => {
          return h(ElInput, {
            disabled: true,
            modelValue: t(value as string)
          });
        }
      },
      {
        label: t("systemMenu.codeSuffix"),
        prop: "name",
        tooltip: t("systemMenu.codeSuffixTip")
      },
      {
        label: t("systemMenu.menuView"),
        prop: "method",
        valueType: "select",
        fieldProps: {
          filterable: true,
          clearable: true,
          multiple: true
        },
        options: computed(() => {
          const result = {};
          menuUrlList.value?.forEach(item => {
            if (item.name !== "#") {
              result[item?.view] = {
                label: item?.view.split(".").pop(),
                value: item?.view,
                fieldSlot: () => {
                  return (
                    <>
                      <span style="float: left">
                        {result[item?.view]?.label}
                      </span>
                      <span style=" float: right; font-size: 13px; color: var(--el-text-color-secondary); ">
                        {item.label}
                      </span>
                    </>
                  );
                }
              };
            }
          });
          return Object.values(result);
        })
      },
      {
        label: t("systemMenu.skipExistingData"),
        prop: "skip_existing",
        valueType: "radio",
        renderField: renderBooleanSegmentedOption()
      }
    ]);

    openFormDialog({
      t,
      isAdd: false,
      title: t("systemMenu.addPermissions"),
      rawRow: { ...row },
      rawColumns: columns.value,
      rawFormProps: {
        rules: {
          method: [
            {
              required: true,
              message: t("systemMenu.menuView"),
              trigger: "blur"
            }
          ]
        }
      },
      dialogOptions: {
        onChange: data => {
          const values = data?.values?.values;
          if (isObject(values) && data?.values?.column?.prop === "method") {
            if (values.method?.length > 1) {
              values.name = values.method
                .map(item => {
                  return item
                    .split(".")
                    .pop()
                    .replace("ViewSet", "")
                    .replace("APIView", "");
                })
                .join(" | ");
            } else {
              values.name = row.name;
            }
          }
        }
      },
      saveCallback: ({ formData, done, closeLoading }) => {
        handleOperation({
          t,
          apiReq: api.permissions(row.pk, {
            views: formData.method,
            skip_existing: formData.skip_existing,
            component: formData.name
          }),
          success() {
            getMenuData();
            done();
          },
          requestEnd() {
            closeLoading();
          }
        });
      }
    });
  };

  onMounted(() => {
    getMenuApiList();
    getMenuData();
    getViews();
    if (hasAuth("list:SystemModelLabelField")) {
      modelLabelFieldApi
        .list({
          page: 1,
          size: 1000,
          parent: 0,
          field_type: FieldChoices.ROLE
        })
        .then(res => {
          if (res.code === 1000) {
            const results = [];
            res.data.results.forEach(item => {
              const value = { pk: item.pk, name: item.name, label: item.label };
              results.push({ ...value, value });
            });
            formatFiledAppParent(results);
            modelList.value = handleTree(results);
          }
        });
    }
  });

  return {
    auth,
    treeData,
    menuData,
    viewList,
    modelList,
    parentIds,
    choicesDict,
    menuUrlList,
    defaultData,
    addNewMenu,
    exportData,
    importData,
    handleDrag,
    openDialog,
    getMenuData,
    handleDelete,
    handleConfirm,
    handleManyDelete,
    handleAddPermissions
  };
}
