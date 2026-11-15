/** @type {import('next').NextConfig} */
const nextConfig = {
  // PGlite ships WASM + data files that must be loaded from node_modules at runtime.
  serverExternalPackages: ["@electric-sql/pglite", "pg", "mammoth"],
};
export default nextConfig;
