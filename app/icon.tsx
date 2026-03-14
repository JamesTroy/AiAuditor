import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
          borderRadius: 8,
        }}
      >
        <div
          style={{
            fontSize: 18,
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
