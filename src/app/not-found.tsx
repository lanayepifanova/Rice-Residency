import Link from "next/link";
import { SideNav } from "./components/SideNav";
import { SiteHeader } from "./components/SiteHeader";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <SideNav />
      <main>
        <h1 className="welcome-heading">Not here</h1>
        <p>
          That page does not exist. The event may have been cancelled, or the link may have been
          revoked.
        </p>
        <p className="field-hint">
          <Link href="/explore">Browse events</Link> · <Link href="/">Go home</Link>
        </p>
      </main>
    </>
  );
}
