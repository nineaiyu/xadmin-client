import { h, ref } from "vue";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { message } from "@/utils/message";
import { useDialogForm } from "@/hooks/useDialogForm";
import { postApi, type PostItem } from "@/api/identity/post";
import PostMembersDialog from "../components/PostMembersDialog.vue";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 提交载荷（与 postApi.assign 的 data 契约一致） */
type MembersPayload = {
  add?: Array<number | string>;
  remove?: Array<number | string>;
};

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

  const { beforeSure } = useDialogForm<MembersPayload>({
    formRef: membersRef,
    submit: payload => postApi.assign(row.pk, payload),
    // 成功文案动态：跳过明细非空时点名（失效/不存在用户的 pk 不阻断保存）
    onSuccess: res => {
      const skipped =
        (res.data as { skipped?: string[] } | null)?.skipped?.length ?? 0;
      if (skipped) {
        message(t("post.memberSkipped", { count: skipped }), {
          type: "warning"
        });
      } else {
        message(t("post.memberSaveOk"), { type: "success" });
      }
      refresh();
    }
  });

  addDialog({
    title: `${t("post.members")}：${row.name}`,
    width: dialogSize("md"),
    draggable: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    sureBtnLoading: true,
    contentRenderer: () =>
      h(PostMembersDialog, { ref: membersRef, row, readonly }),
    beforeSure: (done, ctx) => {
      // 只读查看：直接关闭（不提交）
      if (readonly) {
        done();
        return;
      }
      return beforeSure(done, ctx);
    }
  });
}
