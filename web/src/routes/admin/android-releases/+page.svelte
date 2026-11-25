<script lang="ts">
  import AdminPageLayout from '#lib/components/layouts/AdminPageLayout.svelte';
  import {
    deleteApkMutation,
    getApkReleasesQuery,
    publishApkMutation,
    uploadApkMutation,
  } from '#lib/queries/apk.query.ts';
  import { createPreloadedQuery } from '#lib/queries/client.ts';
  import { Route } from '#lib/route.ts';
  import { Button } from '@immich/ui';
  import { createMutation } from '@tanstack/svelte-query';
  import { t } from 'svelte-i18n';

  const query = createPreloadedQuery(getApkReleasesQuery);
  const upload = createMutation(uploadApkMutation);
  const publish = createMutation(publishApkMutation);
  const remove = createMutation(deleteApkMutation);
  let files = $state<FileList>();
  const busy = $derived(upload.isPending || publish.isPending || remove.isPending);
</script>

<AdminPageLayout breadcrumbs={[{ title: $t('san_android_releases'), href: Route.androidReleases() }]}>
  <div class="mx-auto w-full max-w-3xl space-y-6 p-4">
    <p class="text-sm opacity-75">{$t('san_apk_help')}</p>
    <form
      class="flex flex-wrap items-end gap-4 rounded-2xl border border-primary/20 p-5"
      onsubmit={(event) => {
        event.preventDefault();
        const file = files?.[0];
        if (file) upload.mutate([{ body: { file } }]);
      }}
    >
      <label class="flex flex-1 flex-col gap-2">
        <span>{$t('san_signed_apk')}</span>
        <input type="file" accept=".apk,application/vnd.android.package-archive" bind:files required disabled={busy} />
      </label>
      <Button type="submit" disabled={busy || !files?.length} loading={upload.isPending}>{$t('upload')}</Button>
    </form>
    {#each query.data.releases as release (release.id)}
      <article class="space-y-3 rounded-2xl border border-primary/20 p-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-lg font-semibold">S&amp;AN {release.versionName} · {release.versionCode}</h2>
          <span class="text-sm">{(release.size / 1024 / 1024).toFixed(1)} MB</span>
        </div>
        <code class="block break-all text-xs opacity-70">SHA-256: {release.sha256}</code>
        <div class="flex flex-wrap gap-3">
          {#if query.data.publishedId === release.id}
            <Button disabled={busy} onclick={() => publish.mutate([{ apkPublishDto: { id: null } }])}
              >{$t('san_withdraw_apk')}</Button
            >
          {:else}
            <Button disabled={busy} onclick={() => publish.mutate([{ apkPublishDto: { id: release.id } }])}
              >{$t('san_publish_apk')}</Button
            >
            <Button disabled={busy} color="secondary" onclick={() => remove.mutate([{ id: release.id }])}
              >{$t('delete')}</Button
            >
          {/if}
        </div>
      </article>
    {/each}
  </div>
</AdminPageLayout>
