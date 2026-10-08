import Link from "next/link";

export default function NotFound() {
  return (
    <main>
      <header>
        <h1>PlateWise</h1>
      </header>
      <section className="card">
        <h2>We couldn&apos;t find that plan</h2>
        <p>Check that the link was copied in full, or make a new plan.</p>
        <Link href="/" className="primary">
          Make a plan
        </Link>
      </section>
    </main>
  );
}
