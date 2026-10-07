import { Library } from "@/components/library/Library";
import { paramsFromRecord, paramsToSearch } from "@/components/library/params";
import { requireUser } from "@/lib/auth/user";
import { searchBookmarks, searchParamsFrom } from "@/lib/search/buildSql";
import { listUserTags } from "@/lib/tags/queries";

export default async function LibraryPage({ searchParams }: PageProps<"/">) {
  const userId = await requireUser();
  const params = paramsFromRecord(await searchParams);
  const [initial, tags] = await Promise.all([
    searchBookmarks(userId, searchParamsFrom(paramsToSearch(params))),
    listUserTags(userId),
  ]);
  const allTags = tags.map(({ value, label, count, color }) => ({ value, label, count, color }));
  return <Library initialParams={params} initial={initial} allTags={allTags} />;
}
