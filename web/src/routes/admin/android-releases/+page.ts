import { getApkReleasesQuery } from '#lib/queries/apk.query.ts';
import { queryClient } from '#lib/queries/client.ts';
import { authenticate } from '#lib/utils/auth.ts';
import { getFormatter } from '#lib/utils/i18n.ts';
import type { PageLoad } from './$types';

export const load = (async ({ url }) => {
  await authenticate(url, { admin: true });
  await queryClient.query(getApkReleasesQuery());
  const $t = await getFormatter();
  return { meta: { title: $t('san_android_releases') } };
}) satisfies PageLoad;
