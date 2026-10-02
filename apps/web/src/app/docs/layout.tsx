import { DocsNav } from "@/components/docs/DocsNav";

export default function DocsLayout({ children }: LayoutProps<"/docs">) {
  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 pb-10 sm:px-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-14 lg:py-14">
      <aside className="sticky top-16 z-30 -mx-4 min-w-0 bg-paper/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <DocsNav />
      </aside>
      <article className="min-w-0 max-w-3xl pb-10">{children}</article>
    </div>
  );
}
