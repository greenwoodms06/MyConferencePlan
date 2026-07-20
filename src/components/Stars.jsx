/** 5-star rating. Tap a star to set; tap the same star again to clear.
 *  Rating lives on the journal pick (SPEC §5) and travels with notes/tags. */
export default function Stars({ rating = 0, onRate }) {
  return (
    <div className="stars" onClick={(e) => e.stopPropagation()}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          className={n <= (rating || 0) ? 'on' : ''}
          onClick={() => onRate(rating === n ? 0 : n)}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          aria-pressed={n <= (rating || 0)}
        >
          ★
        </button>
      ))}
    </div>
  )
}
