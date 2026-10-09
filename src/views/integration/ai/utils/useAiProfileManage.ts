import { h } from "vue";
import type { useI18n } from "vue-i18n";
import {
  PanelProfile,
  ReActionPanel,
  openManageDrawer
} from "@/components/ReActionPanel";
import type { AiProfileItem } from "@/api/ai/ai";
import { buildAiProfileData, buildAiProfileMetaItems } from "./aiProfilePanel";
import { buildAiProfileActionGroups } from "./aiProfileActions";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 「管理」抽屉装配（自 useAiProfiles 抽出）：档案资料 + 能力画像 + 探测/配置/
 * 删除动作（低频动作唯一入口）。动作统一「先收起抽屉再执行」：资料卡基于行快照，
 * 重开即最新，同时避免与编辑弹窗、危险操作确认框叠加。
 */
export function useAiProfileManage({
  t,
  flags: { canProbe, canEdit, canDestroy },
  probeProfile,
  openDialog,
  removeProfile
}: {
  t: TFunction;
  flags: {
    canProbe: boolean;
    canEdit: boolean;
    canDestroy: boolean;
  };
  probeProfile: (row: AiProfileItem, withVision?: boolean) => Promise<void>;
  openDialog: (row: AiProfileItem | null) => void;
  removeProfile: (row: AiProfileItem) => Promise<void>;
}) {
  const openProfilePanel = (row: AiProfileItem) => {
    openManageDrawer({
      title: t("aiConfig.panelTitle", { name: row.name }),
      size: "520px",
      render: ({ withClosed }) =>
        h(
          ReActionPanel,
          {
            metaItems: buildAiProfileMetaItems(row, t),
            groups: buildAiProfileActionGroups({
              t,
              flags: { canProbe, canEdit, canDestroy },
              handlers: {
                probe: withClosed(() => probeProfile(row)),
                probeVision: withClosed(() => probeProfile(row, true)),
                edit: withClosed(() => openDialog(row)),
                remove: withClosed(() => removeProfile(row))
              }
            })
          },
          {
            profile: () =>
              h(PanelProfile, { profile: buildAiProfileData(row, t) })
          }
        )
    });
  };

  return { openProfilePanel };
}
