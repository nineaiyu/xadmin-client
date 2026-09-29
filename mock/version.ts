import { defineFakeRoute } from "vite-plugin-fake-server/client";

// 版本与 package.json 单源（__APP_INFO__ 由 vite define 注入构建期常量）：
// dev 态更新提示不再因 mock 写死版本与实际不一致而误报
export default defineFakeRoute([
  {
    url: "/version.json",
    method: "get",
    response: () => {
      return { version: __APP_INFO__.pkg.version, external: "" };
    }
  }
]);
