import { SUCCESS_CODE } from "@/api/types";
import { h, onMounted, reactive, ref, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElSwitch, ElTag } from "element-plus";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import type { OperationProps, PageTableColumn } from "@/components/RePlusPage";
import {
  webhookSubscriptionApi,
  type WebhookEvent,
  type WebhookSubscriptionItem
} from "@/api/system/webhook";
import SubscriptionForm from "../components/SubscriptionForm.vue";

/**
 * Webhook 订阅：CRUD + 测试 + 行内启停。
 *
 * - 新建/编辑关闭框架默认表单按钮，统一走 ReDialog + SubscriptionForm（事件多选语义）；
 * - is_active 自定义开关渲染：默认编辑按钮关闭（auth.partialUpdate=false）会连带
 *   禁用框架 boolean 列开关，故在列渲染层接管，失败回滚行内值；
 * - 删除保留框架默认入口（带二次确认）。
 */
export function useWebhookSubscription(tableRef: Ref) {
  const { t } = useI18n();
  const api = reactive(webhookSubscriptionApi);
  const auth = reactive({
    ...getDefaultAuths("WebhookSubscription"),
    create: false,
    update: false,
    partialUpdate: false
  });
  const canCreate = hasAuth("create:WebhookSubscription");
  const canEdit = hasAuth("partialUpdate:WebhookSubscription");
  const canTest = hasAuth("test:WebhookSubscription");

  const events = ref<WebhookEvent[]>([]);
  const eventLabel = (key: string) =>
    events.value.find(item => item.key === key)?.label ?? key;

  onMounted(async () => {
    const res = await webhookSubscriptionApi.events();
    if (res.code === SUCCESS_CODE) {
      events.value = (res.data as never as WebhookEvent[]) ?? [];
    }
  });

  /** 行内启停：乐观更新，失败回滚（框架默认编辑按钮关闭后的等价能力） */
  const toggleActive = async (row: WebhookSubscriptionItem, value: boolean) => {
    row.is_active = value;
    const res = await webhookSubscriptionApi
      .partialUpdate(row.pk, { is_active: value })
      .catch(error => ({
        code: -1,
        detail: String((error as { detail?: string })?.detail ?? error)
      }));
    if (res.code === SUCCESS_CODE) {
      message(t("webhook.saveOk"), { type: "success" });
      return;
    }
    row.is_active = !value;
    if (res.detail) message(String(res.detail), { type: "warning" });
  };

  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "events":
          column["minWidth"] = 200;
          column["cellRenderer"] = ({ row }) => {
            const keys = (row as WebhookSubscriptionItem).events ?? [];
            if (!keys.length) return h("span", "—");
            return h(
              "span",
              { class: "flex flex-wrap justify-center gap-1" },
              keys.map(key =>
                h(ElTag, { key, size: "small" }, () => eventLabel(key))
              )
            );
          };
          break;
        case "is_active":
          column["cellRenderer"] = ({ row }) =>
            h(ElSwitch, {
              modelValue: (row as WebhookSubscriptionItem).is_active,
              disabled: !canEdit,
              "onUpdate:modelValue": (value: boolean) =>
                toggleActive(row as WebhookSubscriptionItem, value)
            });
          break;
        case "url":
          column["minWidth"] = 220;
          break;
        case "last_failure":
          column["minWidth"] = 160;
          break;
      }
    });
    return columns;
  };

  const testSubscription = async (row: WebhookSubscriptionItem) => {
    const res = await webhookSubscriptionApi.test(row.pk);
    if (res.code === SUCCESS_CODE) {
      message(String(res.detail ?? t("webhook.testDispatched")), {
        type: "success"
      });
    } else if (res.detail) {
      message(String(res.detail), { type: "warning" });
    }
  };

  /* ---------------- 新建 / 编辑（ReDialog + SubscriptionForm） ---------------- */
  const formRef = ref<InstanceType<typeof SubscriptionForm>>();

  const openDialog = (row: WebhookSubscriptionItem | null) => {
    formRef.value = undefined;
    addDialog({
      title: row ? t("webhook.edit") : t("webhook.create"),
      width: dialogSize("md"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () =>
        h(SubscriptionForm, { ref: formRef, row, events: events.value }),
      beforeSure: async (done, { closeLoading }) => {
        const payload = formRef.value?.getPayload();
        if (!payload) {
          closeLoading();
          return;
        }
        // 异常归一为可读失败结果：避免请求异常时 beforeSure 抛错、弹窗 loading 悬挂
        const res = await (
          row
            ? webhookSubscriptionApi.partialUpdate(row.pk, payload)
            : webhookSubscriptionApi.create(payload)
        ).catch(error => ({
          code: -1,
          detail: String((error as { detail?: string })?.detail ?? error)
        }));
        if (res.code === SUCCESS_CODE) {
          message(t("webhook.saveOk"), { type: "success" });
          // 先关弹窗再刷新列表，避免刷新耗时导致弹窗滞留
          done();
          tableRef.value?.handleGetData();
          return;
        }
        if (res.detail) message(String(res.detail), { type: "warning" });
        closeLoading();
      }
    });
  };

  const operationButtonsProps = shallowRef<OperationProps>({
    width: 200,
    buttons: [
      {
        text: t("webhook.test"),
        code: "test",
        props: { type: "success", link: true },
        onClick: ({ row }) => testSubscription(row as WebhookSubscriptionItem),
        show: canTest && 10
      },
      {
        text: t("webhook.edit"),
        code: "edit",
        props: { type: "primary", link: true },
        onClick: ({ row }) => openDialog(row as WebhookSubscriptionItem),
        show: canEdit && 20
      }
    ]
  });

  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("webhook.create"),
        code: "create",
        props: { type: "primary" },
        onClick: () => openDialog(null),
        show: canCreate
      }
    ]
  });

  return {
    api,
    auth,
    listColumnsFormat,
    operationButtonsProps,
    tableBarButtonsProps
  };
}
