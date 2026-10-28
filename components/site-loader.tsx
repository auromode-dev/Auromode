// Entry splash shown on the first full page load. Pure CSS, so it also
// clears itself without JavaScript; client-side navigation never remounts it.
export function SiteLoader() {
  return (
    <div className="site-loader" aria-hidden="true">
      <div className="site-loader-inner">
        <img
          className="site-loader-logo"
          src="/logo%20Auromode.png"
          alt=""
          width={244}
          height={140}
        />
        <span className="site-loader-line" />
        <span className="site-loader-text">
          {"Guesthouse".split("").map((letter, i) => (
            <span key={i} style={{ animationDelay: 0.45 + i * 0.05 + "s" }}>
              {letter}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}
