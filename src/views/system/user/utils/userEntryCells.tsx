import { h } from "vue";
import { ElImage, ElLink } from "element-plus";
import { isReadonlyCell, type PageTableColumn } from "@/components/RePlusPage";
import type { useI18n } from "vue-i18n";
import type { RecordType } from "plus-pro-components";

type TFunction = ReturnType<typeof useI18n>["t"];
type CellRenderer = NonNullable<PageTableColumn["cellRenderer"]>;

/**
 * 头像 / 用户名单元格渲染（自 useUserListColumns 抽出，控制单文件行数）：
 * 两者同为用户管理抽屉入口，回收站只读场景降级为纯展示。
 */
export function userEntryCells({
  t,
  openUserPanel
}: {
  t: TFunction;
  openUserPanel: (row: RecordType) => void;
}) {
  /** 头像即抽屉入口（大图预览移到抽屉资料卡内，行内不再弹大图） */
  const avatar =
    (key: string): CellRenderer =>
    scope => {
      const src = scope.row[key] as string | undefined;
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

  /** 用户名同为抽屉入口：hover 链接态提示可点（回收站只读时保持纯文本） */
  const username: CellRenderer = scope => {
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

  return { avatar, username };
}
