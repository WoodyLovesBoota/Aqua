import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // 같은 와이파이의 폰·다른 기기(192.168.x.x)로 dev 서버를 열 때 HMR·청크 요청이 막혀 첫 로딩이 끝나지 않는다
  allowedDevOrigins: ["192.168.*.*", "*.local"],
  async headers() {
    // 베이크된 생물 메시(<종>-<lod>.<해시>.bin[.gz])는 파일명에 내용 해시가 있으므로 영구 캐시
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },

      {
        source: "/:file([a-z]+-(?:hi|mid|lo)\\.[0-9a-f]{8}\\.bin)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/:file([a-z]+-(?:hi|mid|lo)\\.[0-9a-f]{8}\\.bin\\.gz)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
