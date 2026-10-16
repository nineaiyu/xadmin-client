import { h, type Ref } from "vue";
import { useRouter } from "vue-router";
import { goUserDetail } from "@/views/system/hooks";
import {
  formatPageColumns,
  type PageColumn,
  type PageTableColumn
} from "@/components/RePlusPage";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 解析审计字段 diff 为对照表行：序列化输出为 {field: {old, new}}，容错字符串形态 */
export function parseChanges(
  value: unknown
): Array<{ field: string; old: string; new: string }> {
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  return Object.entries(raw as Record<string, unknown>).map(([field, diff]) => {
    const record = (diff ?? {}) as { old?: unknown; new?: unknown };
    return {
      field,
      old: record.old == null ? "—" : String(record.old),
      new: record.new == null ? "—" : String(record.new)
    };
  });
}

/** 行内 `creator` 嵌套字段（点击跳转 SystemUser 详情） */
type CreatorRow = {
  creator?: { username?: string; pk?: number | string };
};

/**
 * 操作日志列渲染（自 hook.tsx 抽出）：列表列（创建人跳转 / 方法+路径 /
 * 慢请求标红）与详情抽屉列（changes 对照表、request_uuid 可复制）。
 */
export function useOperationLogColumns({
  t,
  slowThreshold
}: {
  t: TFunction;
  slowThreshold: Ref<number>;
}) {
  const router = useRouter();

  function onGoDetail(row: CreatorRow) {
    goUserDetail(router, row?.creator?.pk);
  }

  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      creator: column => {
        column["cellRenderer"] = ({ row }) => (
          <el-link onClick={() => onGoDetail(row)}>
            {row.creator?.username ? row.creator?.username : "/"}
          </el-link>
        );
      },
      path: column => {
        column["cellRenderer"] = ({ row }) => (
          <span>
            {row.method}: {row.path}
          </span>
        );
      },
      method: column => {
        column.hide = true;
      },
      status_code: column => {
        column["minWidth"] = 100;
      },
      module: column => {
        column["minWidth"] = 200;
      },
      exec_time: column => {
        // 慢请求（超阈值）标红；详情/导出含 changes 字段级 diff
        column["cellRenderer"] = ({ row }) =>
          h(
            "span",
            {
              style:
                row.exec_time != null &&
                Number(row.exec_time) > slowThreshold.value
                  ? "color:var(--el-color-danger);font-weight:600"
                  : ""
            },
            row.exec_time == null ? "—" : `${Number(row.exec_time).toFixed(3)}s`
          );
      }
    });

  /** 详情抽屉列渲染：changes 展示 old/new 对照表，request_uuid 可复制，
   *  exec_time 超慢请求阈值标红（与列表列口径一致） */
  const detailColumnsFormat = (columns: PageColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "request_uuid":
          column.render = (value: unknown) => (
            <span v-copy={value}>{value || "—"}</span>
          );
          break;
        case "exec_time":
          column.render = (value: unknown) => (
            <span
              style={{
                color:
                  value != null && Number(value) > slowThreshold.value
                    ? "var(--el-color-danger)"
                    : undefined,
                fontWeight:
                  value != null && Number(value) > slowThreshold.value
                    ? 600
                    : undefined
              }}
            >
              {value == null ? "—" : `${Number(value).toFixed(3)}s`}
            </span>
          );
          break;
        case "changes":
          column.descriptionsItemProps = { span: 2 };
          column.render = (value: unknown) => {
            const rows = parseChanges(value);
            if (!rows.length) return <span>—</span>;
            return (
              <el-table data={rows} size="small" border>
                <el-table-column
                  prop="field"
                  label={t("logsOperation.changesField")}
                  min-width="140"
                  show-overflow-tooltip
                />
                <el-table-column
                  prop="old"
                  label={t("logsOperation.changesOld")}
                  min-width="180"
                  show-overflow-tooltip
                />
                <el-table-column
                  prop="new"
                  label={t("logsOperation.changesNew")}
                  min-width="180"
                  show-overflow-tooltip
                />
              </el-table>
            );
          };
          break;
      }
    });
    return columns;
  };

  return { listColumnsFormat, detailColumnsFormat };
}
