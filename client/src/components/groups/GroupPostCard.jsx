import { useEffect, useState } from 'react';
import { Heart, MessageCircle, Send, Share2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../feedback/ToastProvider.jsx';
import Button from '../ui/Button.jsx';
import { publicService } from '../../services/api.js';
import ProfileAvatar from '../ui/ProfileAvatar.jsx';
import ReliableImage from '../ui/ReliableImage.jsx';

export default function GroupPostCard({ post, groupId, groupType, onLikeChange, canManage = false }) {
  const { user } = useAuth();
  const { error, success } = useToast();
  const [liked, setLiked] = useState(Boolean(post.likedByMe));
  const [likeCount, setLikeCount] = useState(Number(post.likeCount ?? 0));
  const [commentCount, setCommentCount] = useState(Number(post.commentCount ?? 0));
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);

  useEffect(() => {
    setLiked(Boolean(post.likedByMe));
    setLikeCount(Number(post.likeCount ?? 0));
    setCommentCount(Number(post.commentCount ?? 0));
  }, [post.id, post.likedByMe, post.likeCount, post.commentCount]);

  async function toggleLike() {
    if (!user) { error('Sign in to like this post.'); return; }
    const next = !liked;
    setLiked(next);
    setLikeCount((count) => Math.max(0, count + (next ? 1 : -1)));
    try {
      const response = next
        ? await publicService.likeGroupPost(groupId, groupType, post.id)
        : await publicService.unlikeGroupPost(groupId, groupType, post.id);
      const result = response.data?.data;
      setLiked(Boolean(result?.liked));
      setLikeCount(Number(result?.likeCount ?? 0));
      onLikeChange?.(post.id, result);
    } catch (failure) {
      setLiked(!next);
      setLikeCount((count) => Math.max(0, count + (next ? -1 : 1)));
      error('Like could not be saved', failure.message || 'Please try again.');
    }
  }

  async function openComments() {
    const next = !commentsOpen;
    setCommentsOpen(next);
    if (!next || comments.length) return;
    setCommentsLoading(true);
    try {
      const response = await publicService.groupPostComments(groupId, groupType, post.id);
      setComments(response.data?.data ?? []);
    } catch (failure) {
      error('Comments could not be loaded', failure.message || 'Please try again.');
    } finally {
      setCommentsLoading(false);
    }
  }

  async function submitComment(event) {
    event.preventDefault();
    if (!user) { error('Sign in to comment on this post.'); return; }
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      const response = await publicService.createGroupPostComment(groupId, groupType, post.id, { body });
      setComments((current) => [...current, response.data.data]);
      setCommentCount((count) => count + 1);
      setDraft('');
    } catch (failure) {
      error('Comment was not published', failure.message || 'Your draft is still here. Please try again.');
    } finally {
      setPosting(false);
    }
  }

  async function sharePost() {
    const url = `${window.location.origin}${window.location.pathname}#post-${post.id}`;
    setShareBusy(true);
    try {
      if (navigator.share) await navigator.share({ title: post.title, text: post.body, url });
      else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); success('Post link copied.'); }
      else throw new Error('Sharing is unavailable in this browser.');
    } catch (failure) {
      if (failure.name !== 'AbortError') error('Could not share this post', failure.message);
    } finally { setShareBusy(false); }
  }

  const date = post.publishedAt ? new Date(post.publishedAt) : null;
  const dateLabel = date && !Number.isNaN(date.valueOf()) ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';
  const images = Array.isArray(post.imageUrls) && post.imageUrls.length ? post.imageUrls : post.imageUrl ? [post.imageUrl] : [];

  return (
    <article id={`post-${post.id}`} className="group-post-card" aria-labelledby={`post-${post.id}-title`}>
      <header className="group-post-author">
        <ProfileAvatar src={post.authorImageUrl} name={post.authorName} alt={`${post.authorName || 'Community member'} profile picture`} imageClassName="group-post-avatar" fallbackClassName="group-post-avatar group-post-avatar-fallback" />
        <div><strong>{post.authorName || 'Church community'}</strong><span>{dateLabel}{post.updatedAt && post.updatedAt !== post.createdAt ? ' · Edited' : ''}</span></div>
        <span className="group-post-category">{String(post.category || 'UPDATE').replaceAll('_', ' ').toLowerCase()}</span>
      </header>
      <div className="group-post-content">
        <h2 id={`post-${post.id}-title`}>{post.title}</h2>
        <p>{post.body}</p>
        {images.length ? <div className={`group-post-gallery${images.length === 1 ? ' single' : ''}`}>{images.map((image, index) => <a key={`${image}-${index}`} href={image} target="_blank" rel="noreferrer" aria-label={`Open post image ${index + 1} in a new tab`}><ReliableImage src={image} alt="" loading="lazy" fallback={<span className="muted">Image unavailable</span>} /></a>)}</div> : null}
      </div>
      <div className="group-post-engagement"><span>{likeCount} {likeCount === 1 ? 'like' : 'likes'}</span><button type="button" onClick={openComments}>{commentCount} {commentCount === 1 ? 'comment' : 'comments'}</button></div>
      <footer className="group-post-actions">
        <button type="button" className={liked ? 'is-liked' : ''} aria-pressed={liked} onClick={toggleLike}><Heart size={18} fill={liked ? 'currentColor' : 'none'} /> {liked ? 'Liked' : 'Like'}</button>
        <button type="button" aria-expanded={commentsOpen} onClick={openComments}><MessageCircle size={18} /> Comment</button>
        <button type="button" disabled={shareBusy} onClick={sharePost}><Share2 size={18} /> Share</button>
        {canManage ? <span className="group-post-manage-label">Group leader post</span> : null}
      </footer>
      {commentsOpen ? <section className="group-post-comments" aria-label={`Comments on ${post.title}`}>
        <h3>Comments <span>{commentCount}</span></h3>
        {commentsLoading ? <p className="muted" role="status">Loading comments…</p> : comments.length ? <ul>{comments.map((comment) => <li key={comment.id} className={comment.parentCommentId ? 'is-reply' : ''}>
          <ProfileAvatar src={comment.authorImageUrl} name={comment.authorName} alt={`${comment.authorName || 'Member'} profile picture`} imageClassName="group-comment-avatar" fallbackClassName="group-comment-avatar group-post-avatar-fallback" />
          <div><p><strong>{comment.authorName || 'Member'}</strong> <time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time>{comment.editedAt ? <span> · Edited</span> : null}</p><div className="group-comment-body">{comment.body}</div></div>
        </li>)}</ul> : <p className="muted">Be the first to share a thought.</p>}
        <form className="group-comment-form" onSubmit={submitComment}>
          <label className="sr-only" htmlFor={`comment-${post.id}`}>Write a comment</label>
          <textarea id={`comment-${post.id}`} rows={2} maxLength={3000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={user ? 'Write a comment…' : 'Sign in to join the conversation'} disabled={!user || posting} />
          <Button type="submit" size="sm" loading={posting} disabled={!user || !draft.trim()} iconRight={<Send size={14} />}>Send</Button>
        </form>
      </section> : null}
    </article>
  );
}
