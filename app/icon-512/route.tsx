import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
          borderRadius: 100,
        }}
      >
        <div
          style={{
            fontSize: 300,
            fontWeight: 900,
            color: 'white',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          C
        </div>
      </div>
    ),
    { width: 512, height: 512 },
  );
}
