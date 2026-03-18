import { redirect } from 'next/navigation';

export default function CodeAuditRedirect() {
  redirect('/audit?tab=code');
}
