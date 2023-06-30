import { ElMessage } from "element-plus";
import { getUsedAccessToken } from "@/utils/token";
const { VITE_WSS_DOMAIN } = import.meta.env;

interface socket {
  close_callback: Function | null;
  open_callback: Function | null;
  receiveMessage: Function | null;
  websocket: any;
  username: string | string[];
  connectURL: string;
  socket_open: boolean;
  heart_beat_timer: any;
  heart_beat_interval: number;
  is_reconnect: boolean;
  reconnect_count: number;
  reconnect_current: number;
  reconnect_number: number;
  reconnect_timer: any;
  reconnect_interval: number;
  init: (
    username: string | string[],
    receiveMessage: Function | null,
    close_callback: Function | null,
    open_callback: Function | null
  ) => any;
  receive: (message: any) => void;
  heartbeat: () => void;
  send: (data: any, callback?: any) => void;
  close: () => void;
  reconnect: () => void;
}

const socket: socket = {
  receiveMessage: null,
  username: "",
  websocket: null,
  open_callback: null,
  close_callback: null,
  connectURL: "",
  // 开启标识
  socket_open: false,
  // 心跳timer
  heart_beat_timer: null,
  // 心跳发送频率
  heart_beat_interval: 45000,
  // 是否自动重连
  is_reconnect: true,
  // 重连次数
  reconnect_count: 3,
  // 已发起重连次数
  reconnect_current: 1,
  // 网络错误提示此时
  reconnect_number: 0,
  // 重连timer
  reconnect_timer: null,
  // 重连频率
  reconnect_interval: 5000,

  init: async (
    username: string | string[],
    receiveMessage: Function | null,
    close_callback: Function | null,
    open_callback: Function | null
  ) => {
    socket.connectURL = `${VITE_WSS_DOMAIN}/ws/message`;
    socket.username = username;
    socket.receiveMessage = receiveMessage;
    socket.close_callback = close_callback;
    socket.open_callback = open_callback;
    if (!("WebSocket" in window)) {
      ElMessage.warning("浏览器不支持WebSocket");
      return null;
    }
    // 已经创建过连接不再重复创建
    // if (socket.websocket) {
    //   return socket.websocket
    // }

    // const res: any = await websocketToken({ username });
    // let websocket_url = "";
    // if (res.code === 1000) {
    //   websocket_url = `${socket.connectURL}/${username}/${res.data.token}`;
    // } else {
    //   ElMessage.error(res.msg);
    //   return;
    // }
    const group_name = "xadmin";
    const websocket_url = `${socket.connectURL}/${group_name}/${username}`;
    await getUsedAccessToken();
    socket.websocket = new WebSocket(websocket_url);
    socket.websocket.onmessage = (e: any) => {
      if (receiveMessage) {
        receiveMessage(e);
      }
    };

    socket.websocket.onclose = (e: any) => {
      console.log(e);
      if (close_callback) {
        close_callback(e);
      }
      clearInterval(socket.heart_beat_interval);
      socket.socket_open = false;

      // 需要重新连接
      if (socket.is_reconnect) {
        socket.reconnect_timer = setTimeout(() => {
          // 超过重连次数
          if (socket.reconnect_current > socket.reconnect_count) {
            clearTimeout(socket.reconnect_timer);
            socket.is_reconnect = false;
            return;
          }

          // 记录重连次数
          socket.reconnect_current++;
          socket.reconnect();
        }, socket.reconnect_interval);
      }
    };

    // 连接成功
    socket.websocket.onopen = function () {
      socket.socket_open = true;
      socket.is_reconnect = true;
      console.log("socket connect success");
      if (open_callback) {
        open_callback(socket);
      }
      // 开启心跳
      // socket.heartbeat();
    };

    // 连接发生错误
    socket.websocket.onerror = function () {
      console.log("socket connect failed");
      socket.socket_open = false;
    };
  },

  send: (data, callback = null) => {
    // 开启状态直接发送
    if (socket.websocket.readyState === socket.websocket.OPEN) {
      socket.websocket.send(JSON.stringify(data));
      if (callback) {
        callback();
      }

      // 正在开启状态，则等待1s后重新调用
    } else {
      clearInterval(socket.heart_beat_timer);
      if (socket.reconnect_number < 1) {
        ElMessage({
          type: "error",
          message: "socket 连接中，请耐心等待",
          duration: 3000
        });
      }
      socket.reconnect_number++;
    }
  },

  receive: (message: any) => {
    return JSON.parse(message.data).data;
  },

  heartbeat: () => {
    if (socket.heart_beat_timer) {
      clearInterval(socket.heart_beat_timer);
    }

    socket.heart_beat_timer = setInterval(() => {
      const data = {
        authToken: "token",
        content: "ping"
      };
      socket.send(JSON.stringify(data));
    }, socket.heart_beat_interval);
  },

  close: () => {
    clearInterval(socket.heart_beat_interval);
    socket.is_reconnect = false;
    socket.socket_open = false;
    if (socket.websocket) {
      socket.websocket.close();
    }
  },

  /**
   * 重新连接
   */
  reconnect: () => {
    if (socket.websocket && !socket.is_reconnect) {
      socket.close();
    }
    socket.init(
      socket.username,
      socket.receiveMessage,
      socket.close_callback,
      socket.open_callback
    );
  }
};

export default socket;
