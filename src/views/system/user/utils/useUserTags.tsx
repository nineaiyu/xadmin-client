import { h, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import { tagApi } from "@/api/system/tag";
import type { RecordType } from "plus-pro-components";
import UserTagSelect from "../components/UserTagSelect.vue";

/**
 * 用户打标：弹窗多选标签 → 全量替换语义提交。
 *
 * 打标权限回落用户对象的 update 权限点（后端 `ensure_tag_permission` 校验），
 * 按钮显示条件用全局 `assign:Tag` 权限点（少权限时不出现）。
 */
export function useUserTags(tableRef: Ref) {
  const { t } = useI18n();

  const openTagDialog = (row: RecordType) => {
    let childRef: InstanceType<typeof UserTagSelect> | undefined;
    addDialog({
      title: t("tag.assignTitle"),
      width: dialogSize("sm"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () =>
        h(UserTagSelect, {
          ref: element => {
            childRef = element as InstanceType<typeof UserTagSelect>;
          },
          row
        }),
      beforeSure: async (done, { closeLoading }) => {
        const selected = childRef?.getSelected?.() ?? [];
        const res = await tagApi
          .assign({
            resource: "system.userinfo",
            pk: String(row.pk),
            tags: selected
          })
          .catch(error => ({
            code: -1,
            detail: String((error as { detail?: string })?.detail ?? error)
          }));
        if (res.code === SUCCESS_CODE) {
          message(t("tag.assignDone"), { type: "success" });
          // 先关弹窗再刷新列表，避免刷新耗时导致弹窗滞留
          done();
          tableRef.value?.handleGetData();
          return;
        }
        if (res.detail) message(String(res.detail), { type: "warning" });
        closeLoading();
      }
    });
  };

  return { openTagDialog };
}
