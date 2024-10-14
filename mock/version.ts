import { defineFakeRoute } from "vite-plugin-fake-server/client";

// 模拟刷新token接口
export default defineFakeRoute([
  {
    url: "/version.json",
    method: "get",
    response: () => {
      return { version: "4.1.0", external: "" };
    }
  }
]);
