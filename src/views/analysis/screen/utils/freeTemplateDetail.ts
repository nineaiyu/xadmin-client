import { ElMessageBox } from "element-plus";
import type { useI18n } from "vue-i18n";
import { screenTemplateApi } from "@/api/dataset/analysis";
import { isSuccess } from "@/api/types";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 团队模板详情：消费 retrieve 权限，直接展示服务端完整载荷 */
export async function showServerTemplateDetail(id: string, t: TFunction) {
  const res = await screenTemplateApi.retrieve(id).catch(() => null);
  if (res && isSuccess(res)) {
    await ElMessageBox.alert(
      JSON.stringify(res.data, null, 2),
      t("dataScreen.templateDetail"),
      {
        confirmButtonText: t("dataScreen.confirm")
      }
    );
    return;
  }
  await ElMessageBox.alert(
    t("dataScreen.templateDetailFailed"),
    t("dataScreen.templateDetail")
  );
}
