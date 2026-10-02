import { choiceValue, statusTagProps, type StatusTagType } from "@/utils/dict";
import { h, type Ref, type UnwrapNestedRefs } from "vue";
import { ElImage, ElLink, ElTag } from "element-plus";
import {
  isReadonlyCell,
  renderSwitch,
  type usePublicHooks,
  type PageTableColumn
} from "@/components/RePlusPage";
import { renderTagsCell } from "@/utils/tagTone";
import type { useI18n } from "vue-i18n";
import type { userApi } from "@/api/system/user";
import type { RecordType } from "plus-pro-components";

type TFunction = ReturnType<typeof useI18n>["t"];
type SwitchStyle = ReturnType<typeof usePublicHooks>["switchStyle"];

/** 字典色失效时的性别 tag 语义色兜底（1=男 2=女） */
const GENDER_TAG_TYPE: Record<string, StatusTagType> = {
  "0": "primary",
  "1": "primary",
  "2": "danger"
};

/** 用户列表列渲染：头像/用户名（抽屉入口）、性别、启停开关、邀请状态、标签、岗位 */
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
  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "avatar":
          // 头像即用户抽屉入口（回收站只读时降级为纯展示；大图预览移到抽屉资料卡内）
          column["cellRenderer"] = scope => {
            const src = scope.row[column._column?.key as string];
            const image = h(ElImage, {
              lazy: true,
              src,
              // 有头像给可访问名；无头像回落的装饰图 alt 置空（读屏器可忽略）
              alt: src ? t("systemUser.avatarAlt") : "",
              class: ["w-[36px]", "h-[36px]", "align-middle"]
            });
            if (isReadonlyCell(scope)) return image;
            return h(
              "button",
              {
                type: "button",
                class: [
                  "p-0",
                  "border-none",
                  "bg-transparent",
                  "cursor-pointer",
                  "leading-none",
                  "rounded-full"
                ],
                "aria-label": t("systemUser.manageUser", {
                  user: scope.row.username
                }),
                onClick: () => openUserPanel(scope.row)
              },
              [image]
            );
          };
          break;
        case "username":
          // 用户名同为抽屉入口：hover 链接态提示可点（回收站只读时保持纯文本）
          column["cellRenderer"] = scope => {
            if (isReadonlyCell(scope) || !scope.row?.pk) {
              return String(scope.row?.username ?? "");
            }
            return h(
              ElLink,
              {
                type: "primary",
                onClick: () => openUserPanel(scope.row)
              },
              () => scope.row.username
            );
          };
          break;
        case "gender":
          // 字典驱动（user_gender）：字典色优先彩色 tag（统一走 statusTagProps，
          // 避免 ElTag 只换背景导致字体色与字典不一致）；无色回退枚举映射（女=2 danger）
          column["cellRenderer"] = ({ row, props }) => {
            const gender = row.gender;
            return (
              <el-tag
                size={props.size}
                {...statusTagProps(gender, GENDER_TAG_TYPE)}
                effect={gender?.color ? undefined : "plain"}
              >
                {gender?.label ?? ""}
              </el-tag>
            );
          };
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
          // 邀请开户：pending = 待接受邀请；accepted = 已激活；空 = 非邀请账号
          // （choices 字段下发 {value,label} 对象，label 优先走服务端 i18n，前端键兜底）
          column["cellRenderer"] = ({ row, props }) => {
            const raw = row.invite_status;
            const status = choiceValue(raw);
            if (!status) return <span>-</span>;
            return (
              <el-tag
                size={props.size}
                type={status === "pending" ? "warning" : "success"}
                effect="plain"
              >
                {raw?.label ??
                  t(
                    status === "pending"
                      ? "systemUser.invitePending"
                      : "systemUser.inviteAccepted"
                  )}
              </el-tag>
            );
          };
          break;
        case "tags":
          // 通用标签：数组字段需页面自渲染（框架对数组只做 String 化）
          column["cellRenderer"] = renderTagsCell;
          break;
        case "posts":
          // 列表列平铺小标签展示（多值字段框架不做 String 化）；编辑入口在用户表单
          // 内的多选（与角色同口径，元数据驱动自动渲染），岗位页成员分配互为补充
          column["cellRenderer"] = ({ row, props }) => {
            const posts = Array.isArray(row.posts) ? row.posts : [];
            if (!posts.length) return h("span", "-");
            return h(
              "div",
              { class: "flex flex-wrap items-center gap-1" },
              posts.map((item: Record<string, unknown>, index: number) =>
                h(
                  ElTag,
                  {
                    key: String(item?.pk ?? index),
                    size: props.size,
                    effect: "plain"
                  },
                  () => String(item?.name ?? item?.label ?? "")
                )
              )
            );
          };
          break;
      }
    });
    return columns;
  };

  return { listColumnsFormat };
}
