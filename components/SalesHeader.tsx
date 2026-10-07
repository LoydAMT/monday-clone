'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Shared chrome for the sales routes (pipeline, company directory, company
// profile, contact directory) so the module reads as one section rather than three
// unrelated pages. `actions` is the page's own primary button.
export function SalesHeader({
  workspaceId,
  workspaceName,
  title,
  subtitle,
  backHref,
  leading,
  actions,
}: {
  workspaceId: string;
  workspaceName: string;
  title: string;
  subtitle?: React.ReactNode;
  backHref?: { href: string; label: string };
  /** Optional badge shown left of the title — the company monogram. */
  leading?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();
  const pipelineHref = `/sales/${workspaceId}`;
  const companiesHref = `/sales/${workspaceId}/companies`;
  const contactsHref = `/sales/${workspaceId}/contacts`;
  const onCompanies = pathname.startsWith(companiesHref);
  const onContacts = pathname.startsWith(contactsHref);

  return (
    <div className="border-b border-gray-200 bg-white px-6 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          {backHref && (
            <Link href={backHref.href} className="mb-1 inline-block text-xs text-gray-400 hover:text-[#0073ea]">
              ← {backHref.label}
            </Link>
          )}
          <div className="flex min-w-0 items-center gap-2.5">
            {leading}
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-gray-900">{title}</h1>
              <p className="truncate text-sm text-gray-400">{subtitle ?? workspaceName}</p>
            </div>
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>

      <div className="mt-3 flex gap-1">
        <Tab href={pipelineHref} active={!onCompanies && !onContacts}>
          Pipeline
        </Tab>
        <Tab href={companiesHref} active={onCompanies}>
          Companies
        </Tab>
        <Tab href={contactsHref} active={onContacts}>
          Contacts
        </Tab>
      </div>
    </div>
  );
}

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-1.5 text-xs font-medium ${
        active ? 'bg-[#e6f1fd] text-[#0073ea]' : 'text-gray-500 hover:bg-gray-100'
      }`}
    >
      {children}
    </Link>
  );
}
