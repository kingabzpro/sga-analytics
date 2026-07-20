import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #0F172A 0%, #134E4A 100%)",
          borderRadius: 8,
        }}
      >
        <svg
          width="26"
          height="26"
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M11.5 29.5c2.8-7.2 9-12 12.5-12s9.7 4.8 12.5 12"
            stroke="#2DD4BF"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <path
            d="M15.2 28.2c2-5.1 6.2-8.5 8.8-8.5s6.8 3.4 8.8 8.5"
            stroke="#67E8F9"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <path
            d="M18.8 27c1.3-3.2 3.7-5.2 5.2-5.2s3.9 2 5.2 5.2"
            stroke="#A7F3D0"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <circle cx="24" cy="30.5" r="3.2" fill="#F0FDFA" />
          <circle cx="24" cy="30.5" r="1.5" fill="#0D9488" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
