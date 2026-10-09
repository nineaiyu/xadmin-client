import { h, ref } from "vue";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { message } from "@/utils/message";
import { SUCCESS_CODE } from "@/api/types";
import { postApi, type PostItem } from "@/api/identity/post";
import PostMembersDialog from "../components/PostMembersDialog.vue";
import { normalizeError } from "@/utils/apiError";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 岗位成员分配弹窗（ReDialog + PostMembersDialog）：
 * 只读模式直接关闭不提交；保存跳过失效用户 pk 时点名提示（与批量打标同口径）。
 */
export function openPostMembersDialog({
  t,
  refresh,
  row,
  readonly = false
}: {
  t: TFunction;
  refresh: () => void;
  row: PostItem;
  readonly?: boolean;
}) {
  const membersRef = ref<InstanceType<typeof PostMembersDialog>>();

  addDialog({
    title: `${t("post.members")}：${row.name}`,
    width: dialogSize("sm"),
    draggable: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    sureBtnLoading: true,
    contentRenderer: () =>
      h(PostMembersDialog, { ref: membersRef, row, readonly }),
    beforeSure: async (done, { closeLoading }) => {
      // 只读查看：直接关闭（不提交）
      if (readonly) {
        done();
        return;
      }
      const payload = membersRef.value?.getPayload();
      if (!payload) {
        closeLoading();
        return;
      }
      const res = await postApi.assign(row.pk, payload).catch(normalizeError);
      if (res.code === SUCCESS_CODE) {
        // 跳过明细：失效/不存在用户的 pk 不阻断保存，但要点名（与 tags 批量打标同口径）
        const skipped =
          (res.data as { skipped?: string[] } | null)?.skipped?.length ?? 0;
        if (skipped) {
          message(t("post.memberSkipped", { count: skipped }), {
            type: "warning"
          });
        } else {
          message(t("post.memberSaveOk"), { type: "success" });
        }
        done();
        refresh();
        return;
      }
      if (res.detail) message(String(res.detail), { type: "warning" });
      closeLoading();
    }
  });
}
