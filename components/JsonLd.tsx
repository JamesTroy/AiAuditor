const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://claudit.consulting';

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

/** Global structured data for the root layout — single @graph block. */
export function GlobalJsonLd() {
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'Claudit',
        url: BASE_URL,
        logo: `${BASE_URL}/logo.svg`,
      },
      {
        '@type': 'WebSite',
        name: 'Claudit',
        url: BASE_URL,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${BASE_URL}/#agents?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'SoftwareApplication',
        name: 'Claudit',
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Web',
        url: BASE_URL,
        description:
          'AI-powered code audit tool with 50 specialized agents for security, quality, and performance analysis.',
        offers: {
          '@type': 'Offer',
          price: 0,
          priceCurrency: 'USD',
        },
      },
      {
        '@type': 'HowTo',
        name: 'How to run an AI code audit with Claudit',
        step: [
          { '@type': 'HowToStep', position: 1, name: 'Enter a URL or paste code', text: 'Point us at any website, or paste files directly.' },
          { '@type': 'HowToStep', position: 2, name: 'Pick your audits', text: 'Choose from 50 specialized audits — or run them all.' },
          { '@type': 'HowToStep', position: 3, name: 'Get your report', text: 'Severity-rated findings with remediation steps — export as MD or JSON.' },
        ],
      },
    ],
  };

  return <JsonLd data={graph} />;
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
