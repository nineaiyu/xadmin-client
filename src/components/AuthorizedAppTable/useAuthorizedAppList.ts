import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { isSuccess, type BaseResult, type ListResult } from "@/api/types";
import type { AuthorizedApplication } from "@/api/user/authorizedApp";
import { useConfirm } from "@/hooks/useConfirm";
import { message } from "@/utils/message";

/** 两端授权应用 API 的公共面（管理端 / 个人端仅端点与撤销语义不同） */
interface AuthorizedAppApi {
  list: () => Promise<ListResult<AuthorizedApplication>>;
  revoke: (pk: string) => Promise<BaseResult>;
}

/**
 * 已授权应用的加载与撤销（管理端 / 个人端共用）。
 *
 * 撤销是高危动作：二次确认 + 逐行 loading + 失败显式提示；
 * 确认与成功文案按端注入（个人端撤本人 / 管理端撤全量，语义必须区分）。
 */
export function useAuthorizedAppList(options: {
  api: AuthorizedAppApi;
  confirmKey: string;
  successKey: string;
}) {
  const { api, confirmKey, successKey } = options;
  const { t } = useI18n();
  const confirm = useConfirm();
  const rows = ref<AuthorizedApplication[]>([]);
  const loading = ref(false);
  const revoking = ref("");

  const load = async () => {
    loading.value = true;
    try {
      const res = await api.list();
      if (isSuccess(res)) {
        rows.value = res.data?.results ?? [];
      }
    } catch {
      // 网络错误由统一拦截器提示
    } finally {
      loading.value = false;
    }
  };

  const revoke = async (row: AuthorizedApplication) => {
    const ok = await confirm(t(confirmKey, { name: row.application.name }), {
      danger: true
    });
    if (!ok) return;
    revoking.value = row.application.pk;
    try {
      const res = await api.revoke(row.application.pk);
      if (isSuccess(res)) {
        message(t(successKey), { type: "success" });
        await load();
      } else if (res.detail) {
        message(String(res.detail), { type: "warning" });
      }
    } finally {
      revoking.value = "";
    }
  };

  return { rows, loading, revoking, load, revoke };
}
