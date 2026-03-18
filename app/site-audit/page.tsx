import { redirect } from 'next/navigation';

export default function SiteAuditRedirect() {
  redirect('/audit?tab=url');
}
