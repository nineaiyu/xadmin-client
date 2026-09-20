# xadmin-client

The frontend of xadmin — a **metadata-driven** admin interface, built as a secondary development on
[vue-pure-admin](https://github.com/pure-admin/vue-pure-admin) (table columns / forms / search items are
generated from the backend `search-columns` / `search-fields` metadata; the frontend only registers renderers).

Backend: [xadmin-server](https://github.com/nineaiyu/xadmin-server) (Django 6 + DRF + Channels)

**English** | [中文](./README.md)

## Live demo

[https://xadmin.dvcloud.xin/](https://xadmin.dvcloud.xin/) — account: `admin` / `admin123`

## Requirements

| Dependency | Version                      | Notes                                        |
| ---------- | ---------------------------- | -------------------------------------------- |
| Node.js    | >= 22.22.1（`.nvmrc` = v24） | enforced by `engines`                        |
| pnpm       | >= 11                        | enforced by `preinstall` (`only-allow pnpm`) |

## Quick start (local development)

```shell
pnpm install
pnpm dev                # http://127.0.0.1:8848
```

Prerequisite: the backend runs at `127.0.0.1:8896` (start it with
`bash xadmin-server/utils/dev_up.sh --backend-only`).

- Dev proxy (`vite.config.ts`): `/api`, `/media`, `/api-docs` → `http://127.0.0.1:8896`,
  `/ws` → `ws://127.0.0.1:8896` (preconfigured);
- Override the proxy port with `E2E_API_PORT` if the backend is not on the default port;
- `public/platform-config.json` is required at startup (title / layout / theme / route cache switches).

## Build & deploy

```shell
pnpm build              # output in dist/ (same-origin reverse proxy needs no config change)
pnpm build:staging      # staging build
```

Docker build (set the API domain in `.env.production` first):

```shell
docker compose up -d --build   # builds and starts the nginx-web service (port 80 by default)
```

Recommended production setup: serve `dist/` with nginx and proxy `/api`, `/ws`, `/media` to the backend
(template in `xadmin-web/`).

## Quality gates (before commit)

```shell
pnpm typecheck && pnpm typecheck:strict   # type check (strict across the repo)
pnpm lint                                 # eslint + prettier + stylelint
pnpm test:run                             # vitest
pnpm check:contract                       # contract mirror consistency with the backend
pnpm check:version                        # version consistency with the backend
```

E2E (Playwright, chromium + webkit): `pnpm test:e2e` / `pnpm test:e2e:smoke`;
run `pnpm test:e2e:fresh` after backend changes. See [e2e/README.md](e2e/README.md).

## Documentation

- Fork/contribution conventions: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Frontend docs index: [docs/README.md](./docs/README.md)
- Authoritative dev docs live in the backend repo:
  [xadmin-server/docs](https://github.com/nineaiyu/xadmin-server/blob/dev/docs/README.md)

## License

[MIT](./LICENSE)
