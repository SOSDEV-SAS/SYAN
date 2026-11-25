<script lang="ts">
  import { getPublishedApkQuery } from '#lib/queries/apk.query.ts';
  import { Route } from '#lib/route.ts';
  import { Button } from '@immich/ui';
  import { createQuery } from '@tanstack/svelte-query';
  import { t } from 'svelte-i18n';

  const query = createQuery(getPublishedApkQuery);
  const release = $derived(query.data?.release);
</script>

{#if release}
  <section class="mt-6 space-y-3 border-t border-primary/20 pt-5">
    <Button href={Route.apkDownload()} fullWidth>{$t('san_download_android')}</Button>
    <p class="text-center text-sm opacity-70">
      S&amp;AN {release.versionName} · {(release.size / 1024 / 1024).toFixed(1)} MB
    </p>
    <details class="text-xs opacity-70">
      <summary>SHA-256</summary>
      <code class="mt-2 block break-all select-all">{release.sha256}</code>
    </details>
  </section>
{/if}
