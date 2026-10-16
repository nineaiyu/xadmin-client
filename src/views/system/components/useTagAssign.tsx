import { h, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import type { RecordType } from "plus-pro-components";
import TagAssignPanel from "./TagAssignPanel.vue";
import { submitTagAssign, submitTagBatchAssign } from "./tagAssignSubmit";

/**
 * 通用打标弹窗编排：行操作（单对象）与工具栏（批量 + 选中行）共用。
 *
 * - 打标权限回落对象级 update 权限点（后端 `ensure_tag_permission` 逐对象校验）；
 * - 入口显示用全局 `assign:Tag` 权限点，弹窗内「新建标签」按 `create:Tag` 放开；
 * - 批量默认「追加」语义，避免覆盖各对象既有标签（提交明细见 tagAssignSubmit.ts）。
 */
export function useTagAssign(tableRef?: Ref) {
  const { t } = useI18n();

  const openTagDialog = ({
    resource,
    row,
    pks
  }: {
    /** 可打标资源标识（后端 TAGGABLE_MODELS 白名单） */
    resource: string;
    /** 单对象打标（行操作） */
    row?: RecordType;
    /** 批量打标（工具栏 + 选中行） */
    pks?: string[];
  }) => {
    const targetPks = pks ?? [];
    const isBatch = !row?.pk && targetPks.length > 0;
    if (!row?.pk && !isBatch) return;

    let childRef: InstanceType<typeof TagAssignPanel> | undefined;
    addDialog({
      title: isBatch ? t("tag.batchAssignTitle") : t("tag.assignTitle"),
      width: dialogSize("sm"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () =>
        h(TagAssignPanel, {
          ref: element => {
            childRef = element as InstanceType<typeof TagAssignPanel>;
          },
          resource,
          pk: row?.pk ? String(row.pk) : "",
          pks: targetPks,
          showMode: isBatch,
          canCreate: hasAuth("create:Tag")
        }),
      beforeSure: async (done, { closeLoading }) => {
        const payload = childRef?.getPayload?.();
        if (!payload) {
          closeLoading();
          return;
        }
        if (!payload.tags.length && payload.mode !== "replace") {
          message(t("tag.selectRequired"), { type: "warning" });
          closeLoading();
          return;
        }
        if (isBatch) {
          await submitTagBatchAssign({
            t,
            tableRef,
            resource,
            pks: payload.pks,
            tags: payload.tags,
            mode: payload.mode,
            done,
            closeLoading
          });
          return;
        }
        await submitTagAssign({
          t,
          tableRef,
          resource,
          pk: payload.pk,
          tags: payload.tags,
          done,
          closeLoading
        });
      }
    });
  };

  return { openTagDialog };
}
