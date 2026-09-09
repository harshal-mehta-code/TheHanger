import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Generated at build time so iOS home-screen installs get a real icon. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2f2d02",
        }}
      >
        <svg
          width="120"
          height="120"
          viewBox="0 0 32 32"
          fill="none"
          stroke="#ebe1cb"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M16 7.5a2.4 2.4 0 0 0-2.4 2.4c0 1.3 1.1 2.4 2.4 2.4v2.4" />
          <path d="M16 14.7 7 20.8c-1 .7-.5 2.3.7 2.3h16.6c1.2 0 1.7-1.6.7-2.3L16 14.7Z" />
        </svg>
      </div>
    ),
    size,
  );
}
