import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Claudit — AI Code Audit Tool';
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

        {/* Badge */}
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
          }}
        >
          Powered by Claude
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            background: 'linear-gradient(to right, #ffffff, #d4d4d8, #a1a1aa)',
            backgroundClip: 'text',
            color: 'transparent',
            marginBottom: 16,
          }}
        >
          Claudit
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 28,
            color: '#a1a1aa',
            textAlign: 'center',
            maxWidth: 700,
          }}
        >
          AI-powered code audits for security, quality, and performance
        </div>

        {/* Agent count */}
        <div
          style={{
            display: 'flex',
            gap: 32,
            marginTop: 48,
            color: '#71717a',
            fontSize: 20,
          }}
        >
          <span>50 Specialized Audits</span>
          <span>·</span>
          <span>Instant Results</span>
          <span>·</span>
          <span>Free to Use</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
