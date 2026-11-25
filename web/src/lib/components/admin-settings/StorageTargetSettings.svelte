<script lang="ts">
  import SettingButtonsRow from '#lib/components/shared-components/settings/SystemConfigButtonRow.svelte';
  import { featureFlagsManager } from '#lib/managers/feature-flags-manager.svelte.ts';
  import { createPreloadedQuery } from '#lib/queries/client.ts';
  import { getAdminConfigQuery, getStorageTargetsQuery } from '#lib/queries/config-admin.query.ts';
  import { getByteUnitString } from '#lib/utils/byte-units.ts';
  import { Alert, Badge, Text } from '@immich/ui';
  import { createQuery } from '@tanstack/svelte-query';
  import { cloneDeep } from 'lodash-es';
  import { untrack } from 'svelte';
  import { t } from 'svelte-i18n';

  const configQuery = createPreloadedQuery(getAdminConfigQuery);
  const config = $derived(configQuery.data);
  let configToEdit = $state(untrack(() => cloneDeep(config)));
  const targetsQuery = createQuery(() => getStorageTargetsQuery());
  const targets = $derived(targetsQuery.data?.targets ?? []);
  const selected = $derived(targets.find(({ id }) => id === configToEdit.storageTarget.primary));
  const disabled = $derived(featureFlagsManager.value.configFile || !selected?.online || !selected?.writable);
</script>

<section class="mx-4 flex flex-col gap-4 py-4 dark:text-immich-dark-fg">
  <Text>{$t('admin.storage_target_description')}</Text>

  {#if targetsQuery.isError}
    <Alert color="danger" title={$t('admin.storage_target_load_error')} />
  {:else if targets.length > 0}
    <label class="flex flex-col gap-2 text-sm font-medium" for="storage-target-select">
      {$t('admin.storage_target_primary')}
      <select
        id="storage-target-select"
        class="immich-form-input rounded-lg bg-slate-200 p-2 text-sm dark:bg-gray-600"
        bind:value={configToEdit.storageTarget.primary}
        disabled={featureFlagsManager.value.configFile}
      >
        {#each targets as target (target.id)}
          <option value={target.id} disabled={!target.online || !target.writable}>{target.name}</option>
        {/each}
      </select>
    </label>

    <div class="grid gap-3 md:grid-cols-2">
      {#each targets as target (target.id)}
        <article class="rounded-2xl border border-primary/15 bg-primary/5 p-4">
          <div class="flex items-center justify-between gap-2">
            <strong>{target.name}</strong>
            <Badge color={target.online && target.writable ? 'primary' : 'danger'}>
              {target.online && target.writable
                ? $t('admin.storage_target_ready')
                : $t('admin.storage_target_unavailable')}
            </Badge>
          </div>
          <code class="mt-2 block break-all text-xs text-gray-600 dark:text-gray-300">{target.path}</code>
          <Text size="small" color="muted" class="mt-2">
            {$t('admin.storage_target_capacity', {
              values: {
                available: getByteUnitString(target.available),
                total: getByteUnitString(target.total),
              },
            })}
          </Text>
        </article>
      {/each}
    </div>

    {#if selected && (!selected.online || !selected.writable)}
      <Alert color="warning" title={$t('admin.storage_target_selected_unavailable')} />
    {/if}

    <SettingButtonsRow bind:configToEdit keys={['storageTarget']} {disabled} />
  {:else if !targetsQuery.isPending}
    <Alert color="warning" title={$t('admin.storage_target_none')} />
  {/if}
</section>
