import type {
  OperationProps,
  PageColumn,
  PageTableColumn
} from "@/components/RePlusPage";
import { useRouter } from "vue-router";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import { operationLogApi } from "@/api/system/logs/operation";
import { monitorApi } from "@/api/system/monitor";
import { useI18n } from "vue-i18n";
import {
  getCurrentInstance,
  h,
  onMounted,
  reactive,
  ref,
  shallowRef
} from "vue";

export function useOperationLog() {
  const { t } = useI18n();
  const api = reactive(operationLogApi);

  /** 慢请求标红阈值：优先取后端 SysConfig.SLOW_REQUEST_THRESHOLD，
   *  无监控权限或接口异常时回退默认 1 秒 */
  const slowThreshold = ref(1);

  const auth = reactive({
    ...getDefaultAuths(getCurrentInstance())
  });

  onMounted(async () => {
    try {
      const res = await monitorApi.slow();
      const threshold = res?.data?.threshold;
      if (typeof threshold === "number") {
        slowThreshold.value = threshold;
      }
    } catch {
      // 无监控权限或接口异常时沿用默认阈值
    }
  });

  const operationButtonsProps = shallowRef<OperationProps>({
    width: 140
  });
  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "creator":
          column["cellRenderer"] = ({ row }) => (
            <el-link onClick={() => onGoDetail(row)}>
              {row.creator?.username ? row.creator?.username : "/"}
            </el-link>
          );
          break;
        case "path":
          column["cellRenderer"] = ({ row }) => (
            <span>
              {row.method}: {row.path}
            </span>
          );
          break;
        case "method":
          column.hide = true;
          break;
        case "status_code":
          column["minWidth"] = 100;
          break;
        case "module":
          column["minWidth"] = 200;
          break;
        case "exec_time":
          // 慢请求（超阈值）标红；详情/导出含 changes 字段级 diff
          column["cellRenderer"] = ({ row }) =>
            h(
              "span",
              {
                style:
                  row.exec_time != null &&
                  Number(row.exec_time) > slowThreshold.value
                    ? "color:#f56c6c;font-weight:600"
                    : ""
              },
              row.exec_time == null
                ? "—"
                : `${Number(row.exec_time).toFixed(3)}s`
            );
          break;
      }
    });
    return columns;
  };

  const router = useRouter();

  /** 详情抽屉列渲染：changes 展示 old/new 对照表，request_uuid 可复制，
   *  exec_time 超慢请求阈值标红（与列表列口径一致） */
  const detailColumnsFormat = (columns: PageColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "request_uuid":
          column.render = value => <span v-copy={value}>{value || "—"}</span>;
          break;
        case "exec_time":
          column.render = value => (
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
          column.render = value => {
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

  /** 行内 `creator` 嵌套字段（点击跳转 SystemUser 详情） */
  type CreatorRow = {
    creator?: { username?: string; pk?: number | string };
  };

  function onGoDetail(row: CreatorRow) {
    if (hasAuth("list:SystemUser") && row?.creator && row?.creator?.pk) {
      router.push({
        name: "SystemUser",
        query: { pk: row.creator.pk }
      });
    }
  }

  return {
    api,
    auth,
    listColumnsFormat,
    detailColumnsFormat,
    operationButtonsProps
  };
}

/** 解析审计字段 diff 为对照表行：序列化输出为 {field: {old, new}}，容错字符串形态 */
function parseChanges(
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
