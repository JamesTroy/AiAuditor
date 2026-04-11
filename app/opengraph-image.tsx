import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Claudit — Find what your code review missed';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #09090b 0%, #18181b 50%, #09090b 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Grid pattern overlay */}
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
            top: '20%',
            left: '30%',
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(124,58,237,0.3) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />

        {/* Title */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            background: 'linear-gradient(to right, #ffffff, #d4d4d8, #a1a1aa)',
            backgroundClip: 'text',
            color: 'transparent',
            marginBottom: 20,
          }}
        >
          Claudit
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: 32,
            fontWeight: 600,
            color: '#e4e4e7',
            textAlign: 'center',
            maxWidth: 800,
            marginBottom: 12,
          }}
        >
          Find what your code review missed.
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 22,
            color: '#a1a1aa',
            textAlign: 'center',
            maxWidth: 700,
          }}
        >
          Severity-rated security, performance, and accessibility reports — streaming in real time.
        </div>

        {/* Stats */}
        <div
          style={{
            display: 'flex',
            gap: 32,
            marginTop: 48,
            color: '#71717a',
            fontSize: 20,
          }}
        >
          <span>187+ Audits</span>
          <span>·</span>
          <span>OWASP · GDPR · SOC 2</span>
          <span>·</span>
          <span>Free to Use</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
