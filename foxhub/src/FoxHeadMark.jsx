function FoxHeadMark({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Fox head"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M10 8l15 9 7-5 7 5 15-9-5 22 4 11-21 15-21-15 4-11L10 8z"
      />
      <path
        fill="var(--fox-head-cutout, var(--surface))"
        d="M19 25l9 4-7 6-5-2 3-8zm26 0l3 8-5 2-7-6 9-4zM25 39h14l-7 7-7-7z"
      />
      <path
        fill="var(--fox-head-nose, var(--text))"
        d="M28 36h8l-4 5-4-5z"
      />
    </svg>
  );
}

export default FoxHeadMark;
