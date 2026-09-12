import { message } from "@/utils/message";
import type { Reactive, Ref } from "vue";
import { h } from "vue";
import { cloneDeep, deviceDetection } from "@pureadmin/utils";
import { useI18n } from "vue-i18n";
import { addDialog } from "@/components/ReDialog";
import type { menuApi } from "@/api/system/menu";
import type { FormItemProps } from "./types";
import { getMenuFromPk } from "@/utils";
import { MenuChoices } from "@/views/system/constants";
import editForm from "../components/edit.vue";
import type { RecordType } from "plus-pro-components";

/** 菜单新增/编辑弹层：表单装配与保存（拆分自 hook.tsx，纯搬迁） */
export function useMenuDialog({
  api,
  auth,
  treeData,
  choicesDict,
  menuUrlList,
  viewList,
  modelList,
  parentIds,
  formRef,
  defaultData,
  getMenuData
}: {
  api: Reactive<typeof menuApi>;
  auth: Record<string, unknown>;
  treeData: Ref<unknown[]>;
  choicesDict: Ref<RecordType>;
  menuUrlList: Ref<RecordType[]>;
  viewList: Ref<RecordType>;
  modelList: Ref<unknown[]>;
  parentIds: Ref<unknown[]>;
  formRef: Ref;
  defaultData: FormItemProps;
  getMenuData: () => void;
}) {
  const { t } = useI18n();

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
        auth: auth,
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

  return { openDialog, addNewMenu, handleConfirm };
}
