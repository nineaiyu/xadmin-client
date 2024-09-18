import { SystemMsgSubscriptionApi } from "@/api/system/notifications";

export const userMsgSubscriptionApi = new SystemMsgSubscriptionApi(
  "/api/notifications/user-msg-subscription"
);
