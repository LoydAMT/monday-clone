// Next.js shows this automatically the instant you navigate to a board
// whose data isn't loaded yet, swapping back to the real page once
// BoardPage's data fetching resolves — no client-side pending state needed.
export default function BoardLoading() {
  return (
    <div className="flex h-screen flex-1 flex-col overflow-hidden">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-72 animate-pulse rounded bg-gray-100" />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="h-8 w-8 animate-pulse rounded-md bg-gray-100" />
            <div className="h-8 w-8 animate-pulse rounded-md bg-gray-100" />
            <div className="h-8 w-36 animate-pulse rounded-md bg-gray-100" />
            <div className="h-8 w-24 animate-pulse rounded-md bg-gray-200" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-6 py-2.5">
        <div className="h-7 w-full animate-pulse rounded-md bg-gray-100 sm:w-48" />
        <div className="h-7 w-20 shrink-0 animate-pulse rounded-md bg-gray-100" />
        <div className="h-7 w-20 shrink-0 animate-pulse rounded-md bg-gray-100" />
      </div>

      <div className="flex-1 overflow-hidden px-6 py-4">
        <div className="mb-3 h-9 animate-pulse rounded-md bg-gray-100" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-9 animate-pulse rounded bg-gray-50"
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
