import { useEffect, useState } from 'react';
import { ArrowLeft, MoreHorizontal } from 'lucide-react';
import { ProfileAvatar } from '../components/profile/ProfileAvatar';
import { PostCard, PostListFeedback, usePostList } from '../features/posts';
import type { User } from '../types/index';
import { usersApi, FOLLOWING_CHANGED_EVENT } from '../services/users-api';
import { messageOf } from '../shared/api';
import { AsyncStatus, MoreItems } from '../shared/AsyncStatus';

type Props = { viewer: User; go: (page: 'profile') => void; openProfile: (username: string, userId?: number) => void };

export function SwiftProfile({ viewer, go, openProfile }: Props) {
  const params = new URLSearchParams(location.search);
  const requestedUsername = params.get('user') || '';
  const requestedId = params.get('id');
  const username = requestedUsername === viewer.username || !requestedUsername ? viewer.username : requestedUsername;
  const [profile, setProfile] = useState<User | null>(null);
  const [tab, setTab] = useState<'posts' | 'replies' | 'media' | 'likes'>('posts');
  const isFollowing = Boolean(profile?.following);
  const [profileLoading, setProfileLoading] = useState(true), [profileError, setProfileError] = useState('');
  const [busy, setBusy] = useState(false), [attempt, setAttempt] = useState(0);

  const { posts, loading, error, retry, nextCursor, loadMore } = usePostList({ kind: 'user', username: profile?.username ?? '' }, Boolean(profile));

  useEffect(() => {

    const controller = new AbortController(); setProfileLoading(true); setProfileError('');
    usersApi.getProfile(requestedId, username, controller.signal).then((result) => { if (!controller.signal.aborted) setProfile(result); }).catch((failure) => { if (!controller.signal.aborted) setProfileError(messageOf(failure)); }).finally(() => { if (!controller.signal.aborted) setProfileLoading(false); });
    return () => controller.abort();
  }, [username, requestedId, attempt]);
  useEffect(() => {
    const changed = (event: Event) => { const result = (event as CustomEvent<{ userId: number; following: boolean; followersCount: number }>).detail; setProfile((current) => current?.id === result.userId ? { ...current, following: result.following, followersCount: result.followersCount } : current); };
    addEventListener(FOLLOWING_CHANGED_EVENT, changed); return () => removeEventListener(FOLLOWING_CHANGED_EVENT, changed);
  }, []);


  const toggleFollow = async () => {
    if (!profile || profile.id === viewer.id) return;
    if (busy) return; setBusy(true); setProfileError('');
    try { await usersApi.setFollowing(profile.username, !isFollowing, profile.id); } catch (failure) { setProfileError(messageOf(failure)); } finally { setBusy(false); }
  };

  if (!profile) return <section className="profile-empty"><AsyncStatus loading={profileLoading} error={profileError} retry={() => setAttempt((value) => value + 1)}/></section>;
  const ownProfile = profile.id === viewer.id;
  const joined = profile.createdAt ? new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(profile.createdAt)) : 'agosto de 2026';

  return <section className="swift-profile">
    <AsyncStatus loading={profileLoading} error={profileError} retry={() => setAttempt((value) => value + 1)}/>
    <header className="profile-top"><button onClick={() => history.back()} aria-label="Voltar"><ArrowLeft size={19}/></button><div><strong>{profile.username}</strong><small>{posts.length} {posts.length === 1 ? 'post' : 'posts'}</small></div></header>
    <div className={`profile-cover ${profile.cover ? 'has-cover' : ''}`} style={profile.cover ? { backgroundImage: `url(${profile.cover})` } : undefined}/>
    <section className="profile-details">
      <ProfileAvatar user={profile}/>
      <div className="profile-actions">{ownProfile ? <button className="profile-edit" onClick={() => go('profile')}>Editar perfil</button> : <><button className="profile-more" aria-label="Mais opções"><MoreHorizontal size={18}/></button><button className={isFollowing ? 'profile-follow following' : 'profile-follow'} onClick={() => void toggleFollow()}>{isFollowing ? 'Seguindo' : 'Seguir'}</button></>}</div>
      <h1>{profile.username} <span className="era-tag">folklore ✦</span></h1><p className="profile-handle">@{profile.username.replace(/\s/g, '').toLowerCase()}</p>
      {profile.bio && <p className="profile-bio-text">{profile.bio}</p>}
      <p className="profile-meta">📅 Entrou em {joined}</p>
      {profile.location && <p className="profile-meta">{profile.location}</p>}
      {profile.website && <p className="profile-meta"><a href={profile.website} target="_blank" rel="noopener noreferrer">{profile.website}</a></p>}
      <div className="profile-stats"><span><strong>{profile.followingCount ?? 0}</strong> Seguindo</span><span><strong>{profile.followersCount ?? 0}</strong> Seguidores</span></div>
    </section>
    <nav className="profile-tabs"><button className={tab === 'posts' ? 'active' : ''} onClick={() => setTab('posts')}>Posts</button><button className={tab === 'replies' ? 'active' : ''} onClick={() => setTab('replies')}>Respostas</button><button className={tab === 'media' ? 'active' : ''} onClick={() => setTab('media')}>Mídia</button><button className={tab === 'likes' ? 'active' : ''} onClick={() => setTab('likes')}>Curtidas</button></nav>
    {tab === 'posts' ? <section className="profile-posts">
      <PostListFeedback loading={loading} error={error} empty={!posts.length} reload={retry} />
      {posts.map((post) => <PostCard key={post.id} post={post} currentUserId={viewer.id} openProfile={openProfile} variant="profile" era="folklore" />)}
      <MoreItems cursor={nextCursor} loading={loading} load={loadMore}/>
      {!loading && !error && !posts.length && <div className="profile-empty">Ainda não há posts.</div>}
    </section> : <section className="profile-empty">Nada para mostrar nesta aba.</section>}
  </section>;
}
