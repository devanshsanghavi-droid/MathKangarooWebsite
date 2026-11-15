import { getAmcProblemsOfType, getAmcTaxonomy } from '@/lib/amc-content';
import { AMC_OG_ALT, AMC_OG_SIZE, amcOgImage } from '@/components/amc/amc-og';

export const size = AMC_OG_SIZE;
export const contentType = 'image/png';
export const alt = AMC_OG_ALT;

/** Only the types that exist; an unknown id must not fall through to an on-demand render. */
export const dynamicParams = false;

export function generateStaticParams(): Array<{ id: string }> {
  return getAmcTaxonomy().types.map((type) => ({ id: type.id }));
}

export default async function OpenGraphImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const type = getAmcTaxonomy().types.find((entry) => entry.id === id);
  const count = getAmcProblemsOfType(id).length;
  return amcOgImage({
    kicker: 'AMC problem type',
    title: type?.name ?? 'Problem type',
    detail: `${count} ${count === 1 ? 'problem' : 'problems'} in the beta bank`,
  });
}
