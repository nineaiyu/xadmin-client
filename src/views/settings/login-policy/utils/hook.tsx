import { reactive, shallowRef } from "vue";
import { useI18n } from "vue-i18n";
import { loginPolicyApi } from "@/api/system/security";
import { usePageAuth } from "@/router/utils";
import type { OperationProps } from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Search from "~icons/ep/search";
import { useLoginPolicyDialogs } from "./useLoginPolicyDialogs";
import { useLoginPolicyFormOptions } from "./useLoginPolicyFormOptions";

/**
 * 登录访问策略：策略 CRUD + 命中预演。
 *
 * - 新增/编辑走框架元数据表单（`target_type` / `action` 是 LabeledChoiceField，
 *   元数据已带本地化选项，无需前端再拉 choices 端点）；
 * - 预演是页面专属能力，保留 ReDialog 面板与工具栏入口；
 * - 权限点本身不变（create / partialUpdate 仍按菜单授权判定入口可见性）。
 */
export function useLoginPolicy() {
  const { t } = useI18n();
  const api = reactive(loginPolicyApi);
  const auth = usePageAuth(["preview"]);

  const { addOrEditOptions } = useLoginPolicyFormOptions({ t });
  const { openPreview } = useLoginPolicyDialogs({ t });

  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("loginPolicy.preview"),
        code: "preview",
        props: { type: "info", plain: true, icon: useRenderIcon(Search) },
        onClick: () => openPreview(),
        // 与「新增」入口同口径：函数式求值（布尔快照在权限表就绪前求值会失真）
        show: () => Boolean(auth.preview)
      }
    ]
  });

  return { api, auth, addOrEditOptions, tableBarButtonsProps };
}
