import { useState } from 'react';
import { Check, LoaderCircle, Plus } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import Button from '../ui/Button.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../feedback/ToastProvider.jsx';
import { publicService } from '../../services/api.js';

export default function FollowButton({ groupId, groupType, isFollowing, onChange, size = 'sm' }) {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  async function toggleFollow(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!user) {
      navigate('/login', { state: { from: `${location.pathname}${location.search}` } });
      return;
    }
    if (loading) return;
    setLoading(true);
    try {
      if (isFollowing) {
        await publicService.unfollowGroup(groupId, groupType);
        onChange?.(false);
        success('You unfollowed this group.');
      } else {
        const response = await publicService.followGroup(groupId, groupType);
        const payload = response.data?.data;
        onChange?.(true, payload);
        const telegramMessage = payload?.telegramConnected
          ? 'Website following does not automatically join the external Telegram group.'
          : 'Connect Telegram in account settings for Telegram notifications. Website following does not automatically join the external Telegram group.';
        if (payload?.status === 'already_following') success(`You’re already following ${payload.group?.name || 'this group'}.`, telegramMessage);
        else success(`You’re now following ${payload?.group?.name || 'this group'}.`, telegramMessage);
      }
    } catch (failure) {
      error('Could not update your followed groups', failure.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" size={size} variant={isFollowing ? 'secondary' : 'primary'} loading={loading} aria-pressed={Boolean(isFollowing)} onClick={toggleFollow}>
      {loading ? <LoaderCircle size={15} className="spin" aria-hidden="true" /> : isFollowing ? <Check size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}
      {loading ? 'Saving…' : isFollowing ? 'Following' : user ? 'Follow' : 'Sign in to follow'}
    </Button>
  );
}
