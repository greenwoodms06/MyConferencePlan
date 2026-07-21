/**
 * Notify by IMPACT, not by event (SPEC §8.1). A slim accent banner; the detail
 * lives in the review sheet. Counts only the user's own affected picks.
 */
export default function ChangeBanner({ count, onReview }) {
  return (
    <div className="change-banner">
      <div className="change-summary">
        <strong>Schedule updated — {count} of your picks changed</strong>
        <button className="review" onClick={onReview}>Review</button>
      </div>
    </div>
  )
}
