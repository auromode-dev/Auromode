import Link from "next/link";
export default function NotFound() {
  return (
    <section className="page-heading" style={{ paddingBottom: 100 }}>
      <span className="eyebrow">A LITTLE OFF THE BEATEN PATH</span>
      <h1>Let’s find your way back.</h1>
      <p>This page couldn’t be found.</p>
      <Link className="button" href="/" style={{ marginTop: 30 }}>
        Return to Auromode
      </Link>
    </section>
  );
}
