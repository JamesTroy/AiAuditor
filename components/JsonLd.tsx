const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://claudit.dev';

interface JsonLdProps {
  data: Record<string, unknown>;
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/** Global structured data for the root layout. */
export function GlobalJsonLd() {
  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Claudit',
    url: BASE_URL,
    logo: `${BASE_URL}/logo.svg`,
    sameAs: ['https://github.com/JamesTroy/AiAuditor'],
  };

  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Claudit',
    url: BASE_URL,
  };

  const softwareApp = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Claudit',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web',
    url: BASE_URL,
    description:
      'AI-powered code audit tool with 50 specialized agents for security, quality, and performance analysis.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };

  return (
    <>
      <JsonLd data={organization} />
      <JsonLd data={website} />
      <JsonLd data={softwareApp} />
    </>
  );
}

/** Breadcrumb structured data for agent pages. */
export function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; url?: string }[];
}) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      ...(item.url ? { item: item.url } : {}),
    })),
  };

  return <JsonLd data={data} />;
}
