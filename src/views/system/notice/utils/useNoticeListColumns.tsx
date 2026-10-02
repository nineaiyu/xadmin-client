import { ref } from "vue";
import type { noticeApi } from "@/api/system/notice";
import { useRouter } from "vue-router";
import { hasAuth } from "@/router/utils";
import type { useI18n } from "vue-i18n";
import { NoticeChoices } from "@/views/system/constants";
import {
  formatPageColumns,
  isReadonlyCell,
  renderSwitch,
  usePublicHooks,
  type PageTableColumn
} from "@/components/RePlusPage";

type TFunction = ReturnType<typeof useI18n>["t"];
type NoticeApiLike = Pick<typeof noticeApi, "publish">;
type NoticeAuth = { [key: string]: boolean | undefined; publish?: boolean };

/** 公告阅读行（pk 用于跳转阅读详情） */
type NoticeReadRow = { pk?: number | string };

/**
 * 通知公告列表列渲染。
 * 自 useNotice 拆出（行为不变）：标题等级色（字典驱动）、发布开关（权限置灰）、
 * 已读人数「阅读明细」入口（回收站只读降级）。
 */
export function useNoticeListColumns({
  t,
  api,
  auth
}: {
  t: TFunction;
  api: NoticeApiLike;
  auth: NoticeAuth;
}) {
  // 发布开关（publish 列）的加载态与样式：走框架 renderSwitch 同款机制
  const switchLoadMap = ref<Record<number, { loading?: boolean }>>({});
  const { switchStyle } = usePublicHooks();

  const router = useRouter();

  function onGoNoticeReadDetail(row: NoticeReadRow) {
    if (hasAuth("list:SystemNoticeRead") && row.pk) {
      router.push({
        name: "SystemNoticeRead",
        query: { notice_id: row.pk }
      });
    }
  }

  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      title: column => {
        // 字典驱动（notice_level）：字典色优先（el-text style），无色回退
        // 枚举值即 el-text 类型的契约
        column["cellRenderer"] = ({ row }) => (
          <el-text
            type={row.level?.value}
            style={row.level?.color ? { color: row.level.color } : undefined}
          >
            {row.title}
          </el-text>
        );
      },
      publish: column => {
        // 发布开关：文案用「已发布/未发布」（默认「启用/禁用」语义不符）；
        // 无 publish 权限时置灰，权限码不再形同虚设
        column["cellRenderer"] = renderSwitch({
          t,
          updateApi: api.publish,
          switchLoadMap,
          switchStyle,
          field: "publish",
          actionMap: {
            true: t("labels.publish"),
            false: t("labels.unPublish")
          },
          disabled: () => !auth.publish
        });
      },
      read_user_count: column => {
        column["cellRenderer"] = scope => {
          const { row } = scope;
          const content = `${
            row.notice_type?.value === NoticeChoices.NOTICE
              ? t("systemNotice.allRead")
              : row.user_count
          }/${row.read_user_count}`;
          // 回收站只读：不提供「阅读明细」入口
          if (isReadonlyCell(scope)) {
            return <span>{content}</span>;
          }
          return (
            <el-link
              type={row.level?.value}
              style={row.level?.color ? { color: row.level.color } : undefined}
              onClick={() => onGoNoticeReadDetail(row)}
            >
              {content}
            </el-link>
          );
        };
        column["minWidth"] = 140;
      }
    });

  return {
    listColumnsFormat
  };
}
