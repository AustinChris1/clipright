import { DocsNav } from "@/components/docs/DocsNav";

export default function DocsLayout({ children }: LayoutProps<"/docs">) {
  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-14 lg:py-14">
      <aside className="min-w-0">
        <DocsNav />
      </aside>
      <article className="min-w-0 max-w-3xl pb-10">{children}</article>
    </div>
  );
}
