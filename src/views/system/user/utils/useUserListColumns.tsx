import type { Ref, UnwrapNestedRefs } from "vue";
import {
  renderSwitch,
  type usePublicHooks,
  type PageTableColumn
} from "@/components/RePlusPage";
import { renderTagsCell } from "@/utils/tagTone";
import { userEntryCells } from "./userEntryCells";
import { userBadgeCells } from "./userBadgeCells";
import type { useI18n } from "vue-i18n";
import type { userApi } from "@/api/identity/user";
import type { RecordType } from "plus-pro-components";

type TFunction = ReturnType<typeof useI18n>["t"];
type SwitchStyle = ReturnType<typeof usePublicHooks>["switchStyle"];

/**
 * 用户列表列渲染：头像/用户名（抽屉入口，userEntryCells）、启停开关，
 * 性别/邀请状态/标签/岗位（userBadgeCells）。
 */
export function useUserListColumns({
  t,
  api,
  auth,
  switchLoadMap,
  switchStyle,
  openUserPanel
}: {
  t: TFunction;
  api: UnwrapNestedRefs<typeof userApi>;
  auth: { unblock?: boolean };
  switchLoadMap: Ref<Record<string, unknown>>;
  switchStyle: SwitchStyle;
  openUserPanel: (row: RecordType) => void;
}) {
  const { avatar, username } = userEntryCells({ t, openUserPanel });
  const { gender, inviteStatus, posts } = userBadgeCells({ t });

  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "avatar":
          // 头像即用户抽屉入口（回收站只读时降级为纯展示）
          column["cellRenderer"] = avatar(column._column?.key as string);
          break;
        case "username":
          // 用户名同为抽屉入口：hover 链接态提示可点（回收站只读时保持纯文本）
          column["cellRenderer"] = username;
          break;
        case "gender":
          column["cellRenderer"] = gender;
          break;
        case "block":
          column["cellRenderer"] = renderSwitch({
            t,
            updateApi: api.unblock,
            switchLoadMap,
            switchStyle,
            field: column.prop as string,
            disabled: row => !auth.unblock || !row?.block
          });
          break;
        case "invite_status":
          column["cellRenderer"] = inviteStatus;
          break;
        case "tags":
          // 通用标签：数组字段需页面自渲染（框架对数组只做 String 化）
          column["cellRenderer"] = renderTagsCell;
          break;
        case "posts":
          // 岗位列平铺小标签展示；编辑入口在用户表单内的多选，岗位页成员分配互为补充
          column["cellRenderer"] = posts;
          break;
      }
    });
    return columns;
  };

  return { listColumnsFormat };
}
