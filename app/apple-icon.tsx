import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
          borderRadius: 40,
        }}
      >
        <div
          style={{
            fontSize: 100,
            fontWeight: 900,
            color: 'white',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          C
        </div>
      </div>
    ),
    { ...size },
  );
}
