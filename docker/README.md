> [!CAUTION]
> Make sure to use the docker-compose.yml of the current release:
> https://github.com/immich-app/immich/releases/latest/download/docker-compose.yml
> 
> The compose file on main may not be compatible with the latest release.

## S&AN production baseline

The local-source deployment uses `docker-compose.prod.yml`. It builds the API and web from this checkout. The release-image `docker-compose.yml` does not include these local changes and is not the hardened deployment described here.

The API binds to `127.0.0.1:2283`. PostgreSQL and machine learning have no published ports. Monitoring is opt-in with the `monitoring` Compose profile and binds to loopback. Configure a unique Grafana administrator password before enabling monitoring; its data volume preserves existing credentials.

Terminate HTTPS at a reverse proxy on the same host and forward to `127.0.0.1:2283`. A containerized proxy needs a deliberately configured shared network instead; its loopback is not the Docker host. Configure WebSockets, large uploads, timeouts and `/.well-known/immich` according to https://docs.immich.app/administration/reverse-proxy/. Do not expose port 2283 directly to the Internet.

Create an untracked `docker/.env` from `example.env`, replace the sample database password with a unique random secret, and set `IMMICH_TRUSTED_PROXIES` to the actual proxy IP or narrow CIDR as seen by the API. The production Compose requires both variables to be nonempty; this is not a password strength check. Never use the entire LAN or `0.0.0.0/0` as a trusted proxy range. Helmet and the existing web CSP are explicitly enabled.

This Compose stores media under `${UPLOAD_LOCATION}/photos` and PostgreSQL under `${UPLOAD_LOCATION}/postgres`. Do not substitute it for an existing deployment without mapping and verifying its volumes. `DB_DATA_LOCATION` from the release example is not used by this source-build Compose. Keep PostgreSQL on local supported storage. Back up both media and database, keep a separate copy, and verify restoration before migration. Immich provides photo/video storage and backup; it does not replace a general-purpose NAS filesystem or SMB service.

Run builds, tests and code generation through mise. Use `mise tasks ls --all` to inspect tasks, `mise //server:ci-unit` and `mise //web:checklist` for API/web validation, and `mise //mobile:checkout`, `mise //mobile:lint`, `mise //mobile:test` for mobile preparation and validation. `mise //:prod` starts a local-source deployment and must only be used after configuring storage and secrets. Do not use production data for development tests.

### Android release behavior

The release resource overlay disables HTTP and trusts only system certificate authorities. Debug networking remains unchanged. Release APKs require an HTTPS server with a valid certificate, including when accessed on the LAN. User-installed CA certificates and plain LAN IP HTTP URLs will no longer work in release. This policy is consumed by the native Android network stack used by the shared OkHttp client; actual uploads, background backup, media playback and WebSockets still require device validation.

The existing Gradle configuration falls back to debug signing when the release keystore is absent. Supply and verify the private release keystore and signing environment before distributing an APK. Keep the signing key outside Git and preserve it for subsequent updates.

### External connections and remaining audit work

| Connection | Evidence and action |
| --- | --- |
| `tiles.immich.cloud` | Default map styles in `server/src/dtos/config.dto.ts`, also used by mobile. HTTPS, but map browsing contacts a third party. Disable maps or configure a reviewed self-hosted provider when required. |
| `version.immich.cloud` | Production update lookup in `server/src/repositories/config.repository.ts`. HTTPS; retain update monitoring or replace it with a managed patch process. |
| `www.gstatic.com` | Web Google Cast SDK in `web/src/lib/utils/cast/gcast-destination.svelte.ts`. Third-party executable code allowed by the existing CSP; assess whether casting is needed. |
| `pay.futo.org`, `static.immich.cloud` | Allowed by `server/helmet.json`; CSP permission alone does not prove a request occurs. Review the enabled purchase and static-content flows before enforcing an outbound allowlist. |
| Machine learning on port 3003 | Internal HTTP service, now unpublished in the production Compose. Do not make it publicly accessible. Model downloads still need separately reviewed outbound access. |
| SMTP and OAuth | Administrator-configured destinations. SMTP supports `ignoreCert`; leave this disabled and verify provider TLS configuration. Review OAuth redirect URIs and issuer configuration against the real domain. |
| Android custom headers | `HttpClientManager.kt` applies custom headers globally in its interceptor and `getAuthHeaders`. Sensitive proxy headers may reach other requested origins; origin scoping and redirect tests remain required before using this feature in production. |

The source review found CORS enabled only in development and Android backups already disabled. This is not a full authentication/authorization audit, dependency advisory scan, secret-history audit or penetration test. Review custom-header forwarding, APK signing, dependency advisories, authenticated sharing and access-control isolation before production acceptance.

Validation in the current Windows checkout is limited to Compose configuration rendering, XML parsing and diff checks. There are no installed workspace dependencies, and mise and Flutter were not found on PATH. API/web tests, APK build/signature verification, live TLS/proxy behavior and physical-device tests remain pending. No deployment, data migration or deletion was performed.

## S&AN host deployment

Use the production Compose together with `docker-compose.syan.yml`, through `mise //:syan:build` and `mise //:syan:up`. The overlay isolates container names, joins the existing external `proxy` network and publishes no API host port. Set `SYAN_REVISION` to the source commit, and set `IMMICH_TRUSTED_PROXIES` to the exact current Traefik address as seen on that network. Configure a stable proxy address before long-term operation.

The private `docker/.env` must contain `UPLOAD_LOCATION`, `DB_USERNAME`, `DB_DATABASE_NAME`, a unique `DB_PASSWORD`, `SYAN_REVISION`, `IMMICH_TRUSTED_PROXIES`, `SYAN_STORAGE_HOST`, `SYAN_STORAGE_USERNAME` and `SYAN_STORAGE_PASSWORD`. Do not place photos, database files or storage credentials in this checkout. Restrict the environment file to its owner. Verify storage capacity, backups and mounts before starting services.

Public routing defaults to disabled (`SYAN_PUBLIC_ENABLED=false`), and initial account setup is disabled. Bootstrap the administrator only through a temporary local-only override enabling setup and binding `127.0.0.1:2283`, reached through an SSH tunnel. Remove that override after creating the administrator, confirm setup is disabled, then set `SYAN_PUBLIC_ENABLED=true` and rerun the up task. This prevents exposing unauthenticated first-admin registration to the Internet.

Before enabling routing, verify all container health checks, administrator authentication, an upload/download round trip and restored backup. Then verify HTTPS and login through the actual domain.

### Windows D storage

Run `scripts/syan-storage-windows.ps1` from an elevated PowerShell session and pass only the server's Tailscale IPv4 address through `-ServerTailscaleAddress`. The script creates separate encrypted SMB shares for writable media and read-only external libraries, a dedicated local service account with a random password, and a firewall rule restricted to that Tailscale peer. It stores the generated credential under the current Windows profile, outside this repository.

Install `cifs-utils` on the Linux host, copy the generated host, username and password into the private `docker/.env`, then run the S&AN deployment tasks. The server receives the writable share at `/mnt/syan-storage` and the read-only library share at `/mnt/syan-library`. Configure external libraries with paths below `/mnt/syan-library`; never mount the PostgreSQL data directory on SMB.
