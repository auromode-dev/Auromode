"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="page-heading" style={{ paddingBottom: 100 }}>
      <h1>A little pause.</h1>
      <p>This page couldn’t load. Please try again, or contact reception.</p>
      <button className="button" onClick={reset} style={{ marginTop: 30 }}>
        Try again
      </button>
    </section>
  );
}
