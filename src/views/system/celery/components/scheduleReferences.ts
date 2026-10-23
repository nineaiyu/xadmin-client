import { h } from "vue";
import { useRouter } from "vue-router";
import { ElLink, ElMessageBox } from "element-plus";
import type { useI18n } from "vue-i18n";
import type { ScheduleReference } from "@/api/task/task";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 调度引用任务弹窗（自 useScheduleDelete 抽出，控制 hook 行数） */
export function createScheduleReferenceDialog(
  t: TFunction,
  kind: "crontab" | "interval"
) {
  const router = useRouter();

  const goTaskList = (schedulePk: string | number) => {
    ElMessageBox.close();
    router.push({
      path: "/system/celery/task/index",
      query: { [kind]: String(schedulePk) }
    });
  };

  const show = (references: ScheduleReference, schedulePk: string | number) => {
    const tasks = references.tasks ?? [];
    ElMessageBox.alert(
      h("div", [
        h(
          "p",
          t("systemTask.scheduleReferencesHint", { count: references.total })
        ),
        h(
          "ul",
          { class: "pl-4" },
          tasks.map(task =>
            h("li", { class: "leading-7" }, [
              h(
                ElLink,
                { type: "primary", onClick: () => goTaskList(schedulePk) },
                () => task.name
              )
            ])
          )
        ),
        references.truncated
          ? h(
              "p",
              { class: "text-xs text-[var(--el-text-color-secondary)]" },
              t("systemTask.scheduleReferencesTruncated", {
                count: tasks.length
              })
            )
          : null,
        h(
          "p",
          { class: "mt-2 text-xs text-[var(--el-text-color-secondary)]" },
          t("systemTask.scheduleReferencesAction")
        )
      ]),
      t("systemTask.scheduleReferencesTitle"),
      {
        confirmButtonText: t("systemTask.openTaskList"),
        callback: (action: string) => {
          if (action === "confirm") goTaskList(schedulePk);
        }
      }
    ).catch(() => undefined);
  };

  return { show, goTaskList };
}
