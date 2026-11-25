import { asMutation, queryClient } from '#lib/queries/client.ts';
import { QueryKeys } from '#lib/queries/query-keys.ts';
import { deleteApk, getApkReleases, getPublishedApk, publishApk, uploadApk } from '@immich/sdk';
import { queryOptions } from '@tanstack/svelte-query';

export const getPublishedApkQuery = () =>
  queryOptions({
    queryKey: QueryKeys.publishedApk(),
    queryFn: ({ signal }) => getPublishedApk({ signal }),
  });

export const getApkReleasesQuery = () =>
  queryOptions({
    queryKey: QueryKeys.apkReleases(),
    queryFn: ({ signal }) => getApkReleases({ signal }),
  });

const refresh = () => queryClient.invalidateQueries({ queryKey: QueryKeys.apkReleases() });
export const uploadApkMutation = () => asMutation(uploadApk, { onSuccess: refresh });
export const publishApkMutation = () => asMutation(publishApk, { onSuccess: refresh });
export const deleteApkMutation = () => asMutation(deleteApk, { onSuccess: refresh });
