import { reactive, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth, usePageAuth } from "@/router/utils";
import { aiProfileApi } from "@/api/ai/ai";
import { useAiProfileActions } from "./useAiProfileActions";
import { useAiProfileDialog } from "./useAiProfileDialog";
import { useAiProfileManage } from "./useAiProfileManage";
import { useAiProfileColumns } from "./useAiProfileColumns";
import { useAiProfileButtons } from "./useAiProfileButtons";

/**
 * AI 配置档案表格：CRUD + 激活/停用/测试 + 统一「管理」抽屉。
 *
 * - 行内保留在线处置（测试 / 激活 / 停用）；档案参数速览、能力画像与低频动作
 *   （能力探测含多模态、编辑、删除）收敛进「管理」抽屉，操作列由 430 收窄到 240；
 * - 新建/编辑关闭框架默认表单按钮，统一走 ReDialog + AiProfileForm
 *   （api_key 明文不回显、留空沿用原密钥的语义在表单内收敛）；
 * - 删除关闭框架默认入口（带二次确认的删除动作移入抽屉危险区，统一入口）；
 * - is_active 列渲染为彩色 tag（使用中/未激活），与「设为默认/停用」按钮语义一致，
 *   故覆盖框架对 boolean 列的自动开关渲染。
 *
 * 职责拆分：
 * - useAiProfileActions  激活/停用/删除（统一确认）/测试/能力探测；
 * - useAiProfileDialog   新建/编辑弹窗；
 * - useAiProfileManage   「管理」抽屉装配；
 * - useAiProfileColumns  列渲染；
 * - useAiProfileButtons  工具栏与行操作按钮装配。
 */
export function useAiProfiles(tableRef: Ref) {
  const { t } = useI18n();
  const api = reactive(aiProfileApi);
  const auth = usePageAuth("AiProfile");
  auth.create = false;
  auth.update = false;
  auth.partialUpdate = false;
  // 删除收敛进「管理」抽屉危险区，关闭框架默认入口避免两处入口
  auth.destroy = false;
  const canCreate = hasAuth("create:AiProfile");
  const canActivate = hasAuth("activate:AiProfile");
  const canDeactivate = hasAuth("deactivate:AiProfile");
  const canTest = hasAuth("test:AiProfile");
  const canProbe = hasAuth("probe:AiProfile");
  const canEdit = hasAuth("partialUpdate:AiProfile");
  const canDestroy = hasAuth("destroy:AiProfile");

  const refresh = () => tableRef.value?.handleGetData();

  const { activate, deactivate, removeProfile, testProfile, probeProfile } =
    useAiProfileActions({ t, refresh });

  const { openDialog } = useAiProfileDialog({ t, refresh });

  const { openProfilePanel } = useAiProfileManage({
    t,
    flags: { canProbe, canEdit, canDestroy },
    probeProfile,
    openDialog,
    removeProfile
  });

  const { listColumnsFormat } = useAiProfileColumns({ t, openProfilePanel });

  const { operationButtonsProps, tableBarButtonsProps } = useAiProfileButtons({
    t,
    flags: { canCreate, canActivate, canDeactivate, canTest },
    activate,
    deactivate,
    testProfile,
    openDialog,
    openProfilePanel
  });

  return {
    api,
    auth,
    listColumnsFormat,
    operationButtonsProps,
    tableBarButtonsProps
  };
}
