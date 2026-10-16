import { h } from "vue";
import { ElTag } from "element-plus";
import { choiceValue, statusTagProps, type StatusTagType } from "@/utils/dict";
import type { PageTableColumn } from "@/components/RePlusPage";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];
type CellRenderer = NonNullable<PageTableColumn["cellRenderer"]>;

/** 字典色失效时的性别 tag 语义色兜底（1=男 2=女） */
const GENDER_TAG_TYPE: Record<string, StatusTagType> = {
  "0": "primary",
  "1": "primary",
  "2": "danger"
};

/**
 * 性别 / 邀请状态 / 岗位单元格渲染（自 useUserListColumns 抽出，控制单文件行数）。
 * 均为字典或数组形态，框架默认只做 String 化，需页面自渲染。
 */
export function userBadgeCells({ t }: { t: TFunction }) {
  /** 字典驱动（user_gender）：字典色优先彩色 tag；无色回退枚举映射（女=2 danger） */
  const gender: CellRenderer = ({ row, props }) => {
    const value = row.gender;
    return (
      <el-tag
        size={props.size}
        {...statusTagProps(value, GENDER_TAG_TYPE)}
        effect={value?.color ? undefined : "plain"}
      >
        {value?.label ?? ""}
      </el-tag>
    );
  };

  /**
   * 邀请开户：pending = 待接受邀请；accepted = 已激活；空 = 非邀请账号
   * （choices 字段下发 {value,label} 对象，label 优先走服务端 i18n，前端键兜底）
   */
  const inviteStatus: CellRenderer = ({ row, props }) => {
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

  /** 岗位：列表平铺小标签展示（多值字段框架不做 String 化） */
  const posts: CellRenderer = ({ row, props }) => {
    const list = Array.isArray(row.posts) ? row.posts : [];
    if (!list.length) return h("span", "-");
    return h(
      "div",
      { class: "flex flex-wrap items-center gap-1" },
      list.map((item: Record<string, unknown>, index: number) =>
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

  return { gender, inviteStatus, posts };
}
