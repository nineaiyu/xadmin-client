import { message } from "@/utils/message";
import socket from "@/utils/websocket";
import { ElNotification } from "element-plus";
import router from "@/router";
import { h } from "vue";

export function SocketMessage(username: string) {
  const onMessage = (msg_event: { data: string }) => {
    const json_data = JSON.parse(msg_event.data);
    if (json_data.time && json_data.action === "push_message") {
      const data = JSON.parse(json_data.data);
      let message = data?.message;
      switch (data.message_type) {
        case "notify_message":
          if (data?.notice_type?.value === 0) {
            message = h("i", { style: "color: teal" }, data?.message);
          }
          ElNotification({
            title: `${data?.notice_type?.label}-${data?.title}`,
            message: message,
            duration: 5000,
            dangerouslyUseHTMLString: true,
            type: data?.level
              ?.replace("primary", "")
              ?.replace("danger", "warning"),
            onClick: () => {
              router.push({
                name: "UserNotice",
                query: { pk: data?.pk }
              });
            }
          });
          break;
        case "chat_message":
          ElNotification({
            title: `${data?.notice_type?.label}-${data?.title}`,
            message: h("i", { style: "color: teal" }, message),
            duration: 3000,
            onClick: () => {
              router.push({
                name: "Chat"
              });
            }
          });
          break;
        case "error":
          console.log(json_data);
          break;
      }
    } else {
      message(json_data.message, { type: "error" });
    }
  };

  const enterRoomHandle = () => {
    socket.init(username, onMessage, null, () => {
      socket.send({ action: "userinfo", data: {} });
    });
  };
  return {
    enterRoomHandle
  };
}
