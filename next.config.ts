import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // 같은 와이파이의 폰·다른 기기(192.168.x.x)로 dev 서버를 열 때 HMR·청크 요청이 막혀 첫 로딩이 끝나지 않는다
  allowedDevOrigins: ["192.168.*.*", "*.local"],
  // 메인(/)은 전시 목록, 라군은 /lagoon — 옛 /sea 링크와 점검 스크립트(/sea?debug …)는 쿼리를 그대로 들고 /lagoon 으로 (쿼리는 기본으로 따라간다)
  async redirects() {
    return [{ source: "/sea", destination: "/lagoon", permanent: false }];
  },
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
