// 页面层 CSP 隔离验证服务器（E2E 专用：E2E_CSP=1 时由 playwright.config.ts 拉起）。
//
// 目的：把发布门禁 T3「CSP 页面层 enforce」的判据可判化——用「构建产物 + 强制 CSP 头」
// 复现 xadmin-web（nginx 托管 SPA）形态，让 e2e/csp-page.e2e.ts 在真实浏览器里采集
// securitypolicyviolation：应用页面必须零违规，/__csp_probe 探针页必须命中（负对照，
// 证明采集链路本身有效）。切换 nginx 头之前跑一次，替代「等真实流量观察 7 天」。
//
// 用法：pnpm build && pnpm test:e2e:csp
//
// 说明：
// - 只服务 ../dist（生产构建产物，与 deploy-test-server.sh 同步到测试服的同一份）；
// - /api、/media 走代理到 E2E 后端（生产形态里这两条由 nginx 的 xadmin-api-conf 代理），
//   /ws 升级请求按原始握手转发（聊天室/监控/大屏通道）；
// - CSP 头只添加在生产形态需要保护的位置（所有响应），串与 xadmin-web/default.conf
//   的强制头、xadmin-server/server/settings/base.py::_CSP_DIRECTIVES 三处同源。
import { createReadStream, existsSync, statSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIST = path.resolve(fileURLToPath(new URL("../dist", import.meta.url)));
const PORT = Number(process.env.E2E_CSP_PORT ?? 18899);
const API_HOST = process.env.E2E_CSP_API_HOST ?? "127.0.0.1";
const API_PORT = Number(
  process.env.E2E_CSP_API_PORT ?? process.env.E2E_API_PORT ?? 18896
);

/** 强制版 CSP 串（去掉了 "Report-Only"；与 nginx 强制头、_CSP_DIRECTIVES 逐指令一致） */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' ws: wss:",
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "report-uri /api/common/api/csp-report"
].join("; ");

/** 负对照页：内联脚本在 script-src 'self' 下必被拦截，used 于验证采集链路有效 */
const PROBE_HTML =
  '<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>CSP probe</title></head>' +
  "<body><script>window.__cspProbeRan = true;<\/script>PROBE</body></html>";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".wasm": "application/wasm"
};

if (!existsSync(path.join(DIST, "index.html"))) {
  console.error(
    `[csp-page] 未找到构建产物：${DIST}/index.html（先执行 pnpm build）`
  );
  process.exit(1);
}

const respond = (res, status, headers, body) => {
  res.writeHead(status, { "content-security-policy": CSP, ...headers });
  if (body === undefined) {
    res.end();
  } else {
    res.end(body);
  }
};

const proxyHttp = (req, res) => {
  const upstream = http.request(
    {
      host: API_HOST,
      port: API_PORT,
      method: req.method,
      path: req.url,
      headers: { ...req.headers, host: `${API_HOST}:${API_PORT}` }
    },
    upstreamRes => {
      res.writeHead(upstreamRes.statusCode ?? 502, {
        "content-security-policy": CSP,
        ...upstreamRes.headers
      });
      upstreamRes.pipe(res);
    }
  );
  upstream.on("error", err => {
    respond(
      res,
      502,
      { "content-type": "text/plain; charset=utf-8" },
      `proxy error: ${err.message}`
    );
  });
  req.pipe(upstream);
};

const serveStatic = (req, res) => {
  const { pathname } = new URL(req.url ?? "/", "http://csp-page");
  let filePath = path.join(DIST, decodeURIComponent(pathname));
  if (!filePath.startsWith(DIST)) {
    respond(
      res,
      403,
      { "content-type": "text/plain; charset=utf-8" },
      "forbidden"
    );
    return;
  }
  const isFile = existsSync(filePath) && statSync(filePath).isFile();
  if (!isFile) {
    // 带扩展名视为静态资源缺失（返回 index.html 会让浏览器报 MIME 错误，误导定位）
    if (path.extname(pathname)) {
      respond(
        res,
        404,
        { "content-type": "text/plain; charset=utf-8" },
        "not found"
      );
      return;
    }
    filePath = path.join(DIST, "index.html"); // SPA 回退（hash 路由）
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "content-security-policy": CSP,
    "content-type": MIME[ext] ?? "application/octet-stream",
    "cache-control": "no-store"
  });
  createReadStream(filePath).pipe(res);
};

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url ?? "/", "http://csp-page");
  if (pathname === "/__csp_probe") {
    respond(
      res,
      200,
      { "content-type": "text/html; charset=utf-8" },
      PROBE_HTML
    );
    return;
  }
  if (pathname.startsWith("/api/") || pathname.startsWith("/media/")) {
    proxyHttp(req, res);
    return;
  }
  serveStatic(req, res);
});

// WebSocket 升级：原始握手转发（不做协议解析，透传字节流）
server.on("upgrade", (req, socket, head) => {
  const upstream = net.connect(API_PORT, API_HOST, () => {
    const headers = Object.entries({
      ...req.headers,
      host: `${API_HOST}:${API_PORT}`
    })
      .map(([key, value]) => `${key}: ${value}`)
      .join("\r\n");
    upstream.write(`${req.method} ${req.url} HTTP/1.1\r\n${headers}\r\n\r\n`);
    if (head?.length) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });
  const destroy = () => {
    socket.destroy();
    upstream.destroy();
  };
  upstream.on("error", destroy);
  socket.on("error", destroy);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(
    `[csp-page] 强制 CSP 页面服务已启动：http://127.0.0.1:${PORT}（dist=${DIST}）`
  );
});
