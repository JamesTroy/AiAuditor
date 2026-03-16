import { ImageResponse } from 'next/og';
import { getAgent, agents } from '@/lib/agents/registry';

export const alt = 'Claudit Audit';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function AgentOGImage({
  params,
}: {
  params: Promise<{ agent: string }>;
}) {
  const { agent: agentId } = await params;
  const agent = getAgent(agentId);
  const name = agent?.name ?? 'Audit';
  const category = agent?.category ?? '';
  const description = agent?.description ?? '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: 'linear-gradient(135deg, #09090b 0%, #18181b 50%, #09090b 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Grid pattern */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Gradient orb */}
        <div
          style={{
            position: 'absolute',
            top: '10%',
            right: '10%',
            width: 350,
            height: 350,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(124,58,237,0.25) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />

        {/* Category */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 20px',
            borderRadius: 24,
            background: 'rgba(124,58,237,0.15)',
            color: '#a78bfa',
            fontSize: 18,
            marginBottom: 24,
            alignSelf: 'flex-start',
          }}
        >
          {category}
        </div>

        {/* Agent name */}
        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: '#ffffff',
            letterSpacing: '-0.02em',
            marginBottom: 16,
            lineHeight: 1.1,
          }}
        >
          {name}
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: 24,
            color: '#a1a1aa',
            maxWidth: 800,
            lineHeight: 1.4,
          }}
        >
          {description.slice(0, 120)}
          {description.length > 120 ? '...' : ''}
        </div>

        {/* Footer */}
        <div
          style={{
            position: 'absolute',
            bottom: 60,
            left: 80,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            color: '#71717a',
            fontSize: 20,
          }}
        >
          <span style={{ fontWeight: 700, color: '#a1a1aa' }}>Claudit</span>
          <span>·</span>
          <span>Automated Code Audit</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
