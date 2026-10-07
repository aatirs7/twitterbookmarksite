import { AuthorGrid } from "@/components/app/AuthorGrid";
import { requireUser } from "@/lib/auth/user";
import { listAuthors } from "@/lib/tags/queries";

export const metadata = { title: "Authors | Trove" };

export default async function AuthorsPage() {
  const userId = await requireUser();
  const authors = await listAuthors(userId);
  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Authors</h1>
        <p className="text-sm text-muted-foreground">{authors.length.toLocaleString()} people you have bookmarked</p>
      </div>
      <AuthorGrid authors={authors} />
    </div>
  );
}
