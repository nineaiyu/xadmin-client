import { h } from "vue";
import type { useI18n } from "vue-i18n";
import {
  PanelProfile,
  ReActionPanel,
  openManageDrawer
} from "@/components/ReActionPanel";
import type { AiProfileItem } from "@/api/ai/ai";
import { aiProfileApi } from "@/api/ai/ai";
import { isSuccess } from "@/api/types";
import { normalizeError } from "@/utils/apiError";
import { buildAiProfileData, buildAiProfileMetaItems } from "./aiProfilePanel";
import { buildAiProfileActionGroups } from "./aiProfileActions";

import { drawerSize } from "@/components/ReDialog/size";
type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 「管理」抽屉装配（自 useAiProfiles 抽出）：档案资料 + 能力画像 + 探测/配置/
 * 删除动作（低频动作唯一入口）。动作统一「先收起抽屉再执行」：资料卡基于行快照，
 * 重开即最新，同时避免与编辑弹窗、危险操作确认框叠加。
 */
export function useAiProfileManage({
  t,
  flags: { canProbe, canEdit, canDestroy, canRetrieve },
  probeProfile,
  openDialog,
  removeProfile
}: {
  t: TFunction;
  flags: {
    canProbe: boolean;
    canEdit: boolean;
    canDestroy: boolean;
    canRetrieve: boolean;
  };
  probeProfile: (row: AiProfileItem, withVision?: boolean) => Promise<void>;
  openDialog: (row: AiProfileItem | null) => void;
  removeProfile: (row: AiProfileItem) => Promise<void>;
}) {
  const openProfilePanel = async (row: AiProfileItem) => {
    // 消费 retrieve 权限：抽屉资料以详情为准（列表行是快照，激活/探测后会过期）
    let detail = row;
    if (canRetrieve) {
      const res = await aiProfileApi.retrieve(row.pk).catch(normalizeError);
      if (isSuccess(res) && res.data) detail = res.data as AiProfileItem;
    }
    openManageDrawer({
      title: t("aiConfig.panelTitle", { name: detail.name }),
      size: drawerSize("md"),
      render: ({ withClosed }) =>
        h(
          ReActionPanel,
          {
            metaItems: buildAiProfileMetaItems(detail, t),
            groups: buildAiProfileActionGroups({
              t,
              flags: { canProbe, canEdit, canDestroy },
              handlers: {
                probe: withClosed(() => probeProfile(detail)),
                probeVision: withClosed(() => probeProfile(detail, true)),
                edit: withClosed(() => openDialog(detail)),
                remove: withClosed(() => removeProfile(detail))
              }
            })
          },
          {
            profile: () =>
              h(PanelProfile, { profile: buildAiProfileData(detail, t) })
          }
        )
    });
  };

  return { openProfilePanel };
}
