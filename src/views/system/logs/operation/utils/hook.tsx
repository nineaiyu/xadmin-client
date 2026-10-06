import type {
  OperationProps,
  PageColumn,
  PageTableColumn
} from "@/components/RePlusPage";
import { formatPageColumns } from "@/components/RePlusPage";
import { useRouter } from "vue-router";
import { usePageAuth } from "@/router/utils";
import { goUserDetail } from "@/views/system/hooks";
import { operationLogApi } from "@/api/system/logs/operation";
import { monitorApi } from "@/api/system/monitor";
import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import { useI18n } from "vue-i18n";
import { h, onMounted, reactive, ref, shallowRef } from "vue";

export function useOperationLog() {
  const { t } = useI18n();
  const api = reactive(operationLogApi);

  /** 慢请求标红阈值：优先取后端 SysConfig.SLOW_REQUEST_THRESHOLD，
   *  无监控权限或接口异常时回退默认 1 秒 */
  const slowThreshold = ref(1);

  const auth = usePageAuth();
  // 审计日志只读：删除/批量删除端点已下线（留存的收敛由服务端归档命令统一执行），
  // 关闭框架默认入口，避免按钮打了 405
  auth.destroy = false;
  auth.batchDestroy = false;

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

  const router = useRouter();

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

  /** 行内 `creator` 嵌套字段（点击跳转 SystemUser 详情） */
  type CreatorRow = {
    creator?: { username?: string; pk?: number | string };
  };

  function onGoDetail(row: CreatorRow) {
    goUserDetail(router, row?.creator?.pk);
  }

  /**
   * 详情抽屉全量兜底：列表行的 body / response_result 为有界预览（附
   * `*_truncated` 标记），命中标记时经 retrieve 拉全量回填，抽屉打开即为完整正文；
   * 未截断不额外请求。失败经消息出口提示并回退列表行预览（返回 null 不阻断抽屉）。
   */
  const detailRowFetch = async (row: Record<string, unknown>) => {
    const truncated = Boolean(
      row.body_truncated || row.response_result_truncated
    );
    const pk = row.pk;
    if (!truncated || pk == null) return null;
    try {
      const res = await operationLogApi.retrieve(pk as number | string);
      if (res.code === SUCCESS_CODE && res.data) {
        return res.data as Record<string, unknown>;
      }
      message(`${t("results.failed")}，${res.detail}`, { type: "error" });
    } catch {
      // 请求异常已由 http 拦截器统一提示，这里回退列表行预览
    }
    return null;
  };

  return {
    api,
    auth,
    listColumnsFormat,
    detailColumnsFormat,
    detailRowFetch,
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
