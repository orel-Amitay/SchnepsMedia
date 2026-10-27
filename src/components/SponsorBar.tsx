export function SponsorBar() {
  return (
    <a
      className="sponsor-bar"
      href="https://www.schnepsmedia.com/"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Presented by Schneps Media"
    >
      <span className="sponsor-kicker">Presented by</span>
      <img
        className="sponsor-logo"
        src="/schneps-media.png"
        alt="Schneps Media"
        width={140}
        height={78}
      />
    </a>
  )
}
