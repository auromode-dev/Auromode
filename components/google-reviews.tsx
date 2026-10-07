import { ArrowUpRight, MessageSquareQuote, PenLine, Star } from "lucide-react";
import { MotionLink } from "@/components/motion-controls";
import { Reveal } from "@/components/reveal";

// Populate this only from the approved Google integration, never sample reviews.
export type GoogleReviewFeed = {
  rating: number;
  count: number;
  reviews: {
    id: string;
    author: string;
    rating: number;
    text: string;
    date: string;
  }[];
};

export function GoogleReviews({ feed }: { feed?: GoogleReviewFeed }) {
  const reviewsUrl = process.env.GOOGLE_REVIEWS_URL ||
    "https://www.google.com/maps/search/?api=1&query=Auromode+Apartments+Auroville";
  const writeUrl = process.env.GOOGLE_WRITE_REVIEW_URL;
  return (
    <section className="google-reviews section" aria-labelledby="guest-stories-title" id="guest-reviews">
      <Reveal className="reviews-intro">
        <div>
          <span className="eyebrow">THE PEOPLE. THE PLACE. THE MEMORIES.</span>
          <h2 id="guest-stories-title">Every stay<br />has a story.</h2>
        </div>
        <p>Quiet mornings, shared meals, and little discoveries. Get to know Auromode through the experiences of the people who have stayed with us.</p>
      </Reveal>
      <Reveal className="reviews-feature">
        <div className="reviews-feature-copy">
          <span className="reviews-source">Guest experiences on <strong translate="no">Google</strong></span>
          {feed && feed.count > 0 ? (
            <div className="reviews-rating" aria-label={`${feed.rating.toFixed(1)} out of 5 from ${feed.count} Google reviews`}>
              <strong translate="no">{feed.rating.toFixed(1)}</strong>
              <div><span className="reviews-stars" aria-hidden="true">{[1,2,3,4,5].map(n => <Star key={n} size={19} fill={n <= Math.round(feed.rating) ? "currentColor" : "none"} />)}</span><span>{feed.count} Google reviews</span></div>
            </div>
          ) : <h3>A glimpse of life here,<br />in our guests' own words.</h3>}
          <p>Explore guest reviews, photos, and experiences on our Google Business Profile.</p>
          <MotionLink className="button button-ivory" href={reviewsUrl} target="_blank" rel="noopener noreferrer">{process.env.GOOGLE_REVIEWS_URL ? "Read reviews on Google" : "Find Auromode on Google"}<ArrowUpRight size={17} /></MotionLink>
        </div>
        <div className="reviews-invitation">
          <span className="reviews-icon"><MessageSquareQuote size={30} strokeWidth={1.3} aria-hidden="true" /></span>
          <span className="eyebrow">BEEN PART OF OUR STORY?</span>
          <h3>We would love<br />to hear yours.</h3>
          <p>Your honest feedback helps future guests plan their stay and helps us care for the little things that matter.</p>
          {writeUrl ? <MotionLink className="text-link" href={writeUrl} target="_blank" rel="noopener noreferrer"><PenLine size={15} />Write a Google review<ArrowUpRight size={16} /></MotionLink> : <p className="review-sharing-note"><PenLine size={15} aria-hidden="true" />To share your experience, open our Google profile and choose Write a review.</p>}
        </div>
      </Reveal>
      {feed && feed.reviews.length > 0 && <div className="google-review-grid">
        {feed.reviews.map(review => <Reveal key={review.id} className="google-review-card">
          <div className="review-card-top"><span className="review-avatar" aria-hidden="true" translate="no">{review.author.charAt(0)}</span><div><strong translate="no">{review.author}</strong><span>{review.date}</span></div></div>
          <div className="reviews-stars" aria-label={`${review.rating} out of 5 stars`}>{[1,2,3,4,5].map(n=><Star key={n} size={14} aria-hidden="true" fill={n <= review.rating ? "currentColor" : "none"}/>)}</div>
          <p translate="no">{review.text}</p>
          <span className="review-card-source">Posted on Google</span>
        </Reveal>)}
      </div>}
    </section>
  );
}
