import PageHero from '../../components/layout/PageHero.jsx';
import GroupDiscoveryPage from '../../components/groups/GroupDiscoveryPage.jsx';

export default function BibleStudyPage() {
  return (
    <div className="app-main">
      <PageHero eyebrow="Bible study" title="Grow together in the Word" subtitle="Find a small group for Scripture, conversation, and prayer." imageUrl="https://images.unsplash.com/photo-1504052434569-70ad5836ab65?auto=format&fit=crop&w=1920&q=85" />
      <div className="container-wide" style={{ padding: '2rem 0 3.5rem' }}>
        <GroupDiscoveryPage
          fixedType="bible_study_group"
          title="Mid-week groups & study times"
          description="Small-group Scripture study across the parish. Find a group for conversation, prayer, and growing together in the Word."
        />
      </div>
    </div>
  );
}
