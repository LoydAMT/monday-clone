// Shown while SalesPipelinePage's data resolves — the header/tabs, stat row,
// toolbar and board columns in skeleton form, mirroring the inventory page's
// loading idiom so navigation between the two feels the same.
export default function SalesPipelineLoading() {
  return (
    <div className="flex h-screen flex-1 flex-col overflow-hidden">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-6 w-40 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-56 animate-pulse rounded bg-gray-100" />
          </div>
          <div className="h-8 w-28 shrink-0 animate-pulse rounded-md bg-gray-200" />
        </div>
        <div className="mt-3 flex gap-1">
          <div className="h-7 w-20 animate-pulse rounded-md bg-gray-100" />
          <div className="h-7 w-24 animate-pulse rounded-md bg-gray-100" />
        </div>
      </div>

      <div className="flex gap-3 border-b border-gray-200 bg-white px-6 py-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 w-32 animate-pulse rounded-md bg-gray-50" />
        ))}
      </div>

      <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-6 py-2.5">
        <div className="h-7 w-full animate-pulse rounded-md bg-gray-100 sm:w-64" />
        <div className="h-7 w-28 shrink-0 animate-pulse rounded-md bg-gray-100" />
        <div className="h-7 w-32 shrink-0 animate-pulse rounded-md bg-gray-100" />
      </div>

      <div className="flex flex-1 gap-3 overflow-hidden px-6 py-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-64 w-64 shrink-0 animate-pulse rounded-md bg-gray-50"
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
