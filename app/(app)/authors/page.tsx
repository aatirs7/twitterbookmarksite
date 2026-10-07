import { AuthorGrid } from "@/components/app/AuthorGrid";
import { PageHeader } from "@/components/app/PageHeader";
import { requireUser } from "@/lib/auth/user";
import { listAuthors } from "@/lib/tags/queries";

export const metadata = { title: "Authors | XBookmarkVault" };

export default async function AuthorsPage() {
  const userId = await requireUser();
  const authors = await listAuthors(userId);
  return (
    <div className="flex flex-col items-center gap-8">
      <PageHeader
        index="03"
        label="Authors"
        title={<>The <span className="text-muted-foreground italic">people</span></>}
        subtitle={`${authors.length.toLocaleString()} accounts you have saved from.`}
      />
      <AuthorGrid authors={authors} />
    </div>
  );
}
