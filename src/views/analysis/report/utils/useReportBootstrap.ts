import { onMounted, type Ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { isSuccess } from "@/api/types";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { message } from "@/utils/message";
import { datasetApi, listRows, type DatasetItem } from "@/api/dataset/datasets";
import {
  relatedPk,
  reportApi,
  type ReportDesign,
  type ReportItem
} from "@/api/dataset/analysis";
import { designTableLimit } from "./design";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 报表设计器装载时序（自 designer.vue 抽出，行数门禁）。
 *
 * 进场校验（缺 pk / 拉取失败即退回列表）→ 报表详情 + 数据集清单 → 按归属数据集
 * 回填 design（深拷贝，编辑不动服务端原值）。数据集清单装载失败与「清单里没有
 * 该数据集」是两种语义：前者提示后可继续看设计（取数入口按空数据集降级），
 * 后者才是「不可见/已删除」的业务降级（datasetMissing 置位 + 显式报错）。
 */
export function useReportBootstrap(deps: {
  t: TFunction;
  report: Ref<ReportItem | null>;
  dataset: Ref<DatasetItem | null>;
  /** 数据集不可见/已删除：进入显式空态（报表绑定的数据集对当前用户无可见行） */
  datasetMissing: Ref<boolean>;
  design: Ref<ReportDesign>;
  loading: Ref<boolean>;
}) {
  const route = useRoute();
  const router = useRouter();

  onMounted(async () => {
    const pk = String(route.query.pk ?? "");
    if (!pk) {
      message(deps.t("dataReport.pickReportFirst"), { type: "warning" });
      router.replace("/analysis/report/index");
      return;
    }
    const res = await reportApi.retrieve(pk).catch(() => null);
    if (!res || !isSuccess(res) || !res.data) {
      message(deps.t("dataReport.loadFailed"), { type: "warning" });
      router.replace("/analysis/report/index");
      return;
    }
    deps.report.value = res.data as ReportItem;
    const datasetPk = relatedPk(deps.report.value.dataset);
    // 数据集清单装载失败与「清单里没有该数据集」是两种语义（见文件头注释）
    const datasetRows = await fetchAllRows(datasetApi.list).catch(() => null);
    if (!datasetRows) {
      message(deps.t("dataReport.datasetsLoadFailed"), { type: "warning" });
    } else {
      deps.dataset.value =
        listRows<DatasetItem>(datasetRows as never).find(
          item => item.pk === datasetPk
        ) ?? null;
      // 数据集对当前用户不可见（personal/已删除）→ 显式降级：提示 + 禁保存/运行，
      // 侧栏与组件卡不以空数据集取数（明细表预览对空 pk 自身即跳过）
      if (!deps.dataset.value) {
        deps.datasetMissing.value = true;
        message(deps.t("dataReport.datasetUnavailable"), { type: "error" });
      }
    }
    deps.design.value = {
      columns: [...(deps.report.value.design?.columns ?? [])],
      table_limit: designTableLimit(deps.report.value.design),
      components: (deps.report.value.design?.components ?? []).map(item => ({
        ...item
      }))
    };
    deps.loading.value = false;
  });
}
