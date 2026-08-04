// Mirrors inventory/[workspaceId]/loading.tsx's skeleton idiom.
export default function AttendanceLoading() {
  return (
    <div className="flex h-screen flex-1 flex-col overflow-hidden">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="space-y-2">
          <div className="h-6 w-32 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-48 animate-pulse rounded bg-gray-100" />
        </div>
      </div>

      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="h-12 w-full animate-pulse rounded-md bg-gray-100" />
      </div>

      <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-6 py-2.5">
        <div className="h-7 w-24 animate-pulse rounded-md bg-gray-100" />
        <div className="h-7 w-32 animate-pulse rounded-md bg-gray-100" />
      </div>

      <div className="flex-1 overflow-hidden px-6 py-4">
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded bg-gray-50"
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
