// Next.js shows this automatically the instant you navigate to a workspace's
// inventory page whose data isn't loaded yet, swapping back to the real page
// once InventoryPage's data fetching resolves — no client-side pending state
// needed. Mirrors board/[boardId]/loading.tsx's skeleton idiom.
export default function InventoryLoading() {
  return (
    <div className="flex h-screen flex-1 flex-col overflow-hidden">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-6 w-40 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-56 animate-pulse rounded bg-gray-100" />
          </div>
          <div className="h-8 w-28 shrink-0 animate-pulse rounded-md bg-gray-200" />
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-6 py-2.5">
        <div className="h-7 w-full animate-pulse rounded-md bg-gray-100 sm:w-64" />
        <div className="h-7 w-32 shrink-0 animate-pulse rounded-md bg-gray-100" />
        <div className="h-7 w-24 shrink-0 animate-pulse rounded-md bg-gray-100" />
      </div>

      <div className="flex-1 overflow-hidden px-6 py-4">
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded bg-gray-50"
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
