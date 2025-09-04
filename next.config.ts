import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * The whole site is built to static files.
   *
   * Not a performance tweak — it is what lets the database stay on the laptop.
   * The build runs here, where Postgres is, and what gets deployed is the
   * finished HTML. Nothing in the datacenter ever needs a connection string,
   * because nothing in the datacenter runs any of this code.
   *
   * It is also a guardrail. Under `export` a page that still wants a server —
   * one reading `searchParams`, or a dynamic route with no `generateStaticParams`
   * — fails the build here, on this machine, instead of deploying cleanly and
   * then returning 500s to the house because the site it reached for a database
   * that isn't there.
   */
  output: "export",
};

export default nextConfig;
