import { type FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, Bookmark, Eye, MessageSquare, MoreHorizontal, Repeat2, Send, Share, ThumbsUp } from 'lucide-react';

type User = { id: number; username: string; bio?: string; avatar?: string; cover?: string; createdAt?: string };
type Post = { id: number; content: string; image?: string; likes?: number; liked?: boolean; commentCount?: number; reposts?: number; reposted?: boolean; views?: number; saved?: boolean; shares?: number; createdAt: string };
type Comment = { id: number; content: string; user?: Pick<User, 'username' | 'avatar'> };

type Props = { viewer: User; go: (page: 'profile') => void };
const headers = (): Record<string, string> => localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {};

function Avatar({ user }: { user: User }) {
  return user.avatar ? <img className="profile-avatar" src={user.avatar} alt="" /> : <span className="profile-avatar profile-initials">{user.username.slice(0, 2).toUpperCase()}</span>;
}

function ProfileComments({ postId, onCountChange }: { postId: number; onCountChange: (count: number) => void }) {
  const [items, setItems] = useState<Comment[]>([]);
  const [content, setContent] = useState('');
  const load = async () => { const response = await fetch(`/api/posts/${postId}/comments`, { headers: headers() }); if (!response.ok) return; const comments = await response.json() as Comment[]; setItems(comments); onCountChange(comments.length); };
  useEffect(() => { void load(); }, [postId]);
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!content.trim()) return; const response = await fetch(`/api/posts/${postId}/comments`, { method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) }); if (response.ok) { setContent(''); void load(); } };
  return <section className="comments profile-comments"><div className="comment-list">{items.map((item) => <div className="comment" key={item.id}>{item.user?.avatar ? <img className="avatar" src={item.user.avatar} alt=""/> : <span className="avatar avatar-fallback">{item.user?.username.slice(0, 2).toUpperCase() || '?'}</span>}<div className="comment-body"><p><strong>{item.user?.username}</strong>{item.content}</p></div></div>)}</div><form onSubmit={submit}><input value={content} onChange={(event) => setContent(event.target.value)} placeholder="Escreva um comentário"/><button aria-label="Enviar comentário"><Send size={16}/></button></form></section>;
}

function ProfilePostActions({ post, onUpdate }: { post: Post; onUpdate: (postId: number, patch: Partial<Post>) => void }) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const like = async () => { const response = await fetch(`/api/posts/${post.id}/like`, { method: 'POST', headers: headers() }); if (response.ok) { const result = await response.json(); onUpdate(post.id, { likes: result.likes, liked: result.liked }); } };
  const repost = async () => { const response = await fetch(`/api/posts/${post.id}/repost`, { method: 'POST', headers: headers() }); if (response.ok) { const result = await response.json(); onUpdate(post.id, { reposts: result.reposts, reposted: result.reposted }); setFeedback(result.reposted ? 'Publicação repostada.' : 'Repost removido.'); } };
  const save = async () => { const response = await fetch(`/api/posts/${post.id}/save`, { method: 'POST', headers: headers() }); if (response.ok) { const result = await response.json(); onUpdate(post.id, { saved: result.saved }); setFeedback(result.saved ? 'Publicação salva.' : 'Publicação removida dos salvos.'); } };
  const share = async () => {
    const url = `${location.origin}/feed.html#post-${post.id}`;
    let usedNativeShare = false;
    try {
      if (navigator.share) { usedNativeShare = true; await navigator.share({ title: 'Publicação na Swiftline', text: post.content, url }); }
      else if (navigator.clipboard) { await navigator.clipboard.writeText(url); setFeedback('Link copiado.'); }
      else if (window.prompt('Copie o link da publicação:', url) === null) return;
      const response = await fetch(`/api/posts/${post.id}/share`, { method: 'POST', headers: headers() });
      if (response.ok) { const result = await response.json(); onUpdate(post.id, { shares: result.shares }); if (usedNativeShare) setFeedback('Publicação compartilhada.'); }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setFeedback('Não foi possível compartilhar agora.');
    }
  };
  return <><footer><button className={commentsOpen ? 'active-reaction' : ''} aria-label="Comentários" aria-expanded={commentsOpen} onClick={() => setCommentsOpen(!commentsOpen)}><MessageSquare size={16}/><span>{post.commentCount || 0}</span></button><button className={post.reposted ? 'active-reaction' : ''} aria-label={post.reposted ? 'Remover repost' : 'Repostar'} aria-pressed={Boolean(post.reposted)} onClick={() => void repost()}><Repeat2 size={16}/><span>{post.reposts || 0}</span></button><button className={post.liked ? 'active-reaction' : ''} aria-label={post.liked ? 'Remover curtida' : 'Curtir'} aria-pressed={Boolean(post.liked)} onClick={() => void like()}><ThumbsUp size={16}/><span>{post.likes || 0}</span></button><button aria-label={`${post.views || 0} visualizações`} onClick={() => setFeedback(`${post.views || 0} visualizações únicas.`)}><Eye size={16}/><span>{post.views || 0}</span></button><button className={post.saved ? 'active-reaction' : ''} aria-label={post.saved ? 'Remover dos salvos' : 'Salvar'} aria-pressed={Boolean(post.saved)} onClick={() => void save()}><Bookmark size={16} fill={post.saved ? 'currentColor' : 'none'}/></button><button aria-label="Compartilhar" onClick={() => void share()}><Share size={16}/>{Boolean(post.shares) && <span>{post.shares}</span>}</button></footer>{feedback && <p className="action-feedback" role="status">{feedback}</p>}{commentsOpen && <ProfileComments postId={post.id} onCountChange={(count) => onUpdate(post.id, { commentCount: count })}/>}</>;
}

export function SwiftProfile({ viewer, go }: Props) {
  const params = new URLSearchParams(location.search);
  const requestedUsername = params.get('user') || '';
  const requestedId = params.get('id');
  const username = requestedUsername === viewer.username || !requestedUsername ? viewer.username : requestedUsername;
  const [profile, setProfile] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followers, setFollowers] = useState<User[]>([]);
  const [following, setFollowing] = useState<User[]>([]);
  const [tab, setTab] = useState<'posts' | 'replies' | 'media' | 'likes'>('posts');
  const [isFollowing, setIsFollowing] = useState(false);

  const loadPosts = async (currentProfile: User) => {
    const response = await fetch(`/api/posts?username=${encodeURIComponent(currentProfile.username)}`, { headers: headers() });
    if (!response.ok) return;
    const items = await response.json() as Post[];
    setPosts(items);
    if (!items.length) return;
    const viewResponse = await fetch('/api/posts/views', { method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify({ postIds: items.map((post) => post.id) }) });
    if (viewResponse.ok) { const result = await viewResponse.json() as { views: Record<number, number> }; setPosts((current) => current.map((post) => ({ ...post, views: result.views[post.id] ?? post.views ?? 0 }))); }
  };

  useEffect(() => {
    const profileRequest = requestedId ? `/api/users/id/${requestedId}` : `/api/users/username/${encodeURIComponent(username)}`;
    fetch(profileRequest, { headers: headers() }).then((response) => response.ok ? response.json() : null).then((currentProfile: User | null) => { setProfile(currentProfile); if (!currentProfile) return; void loadPosts(currentProfile); fetch(`/api/users/${encodeURIComponent(currentProfile.username)}/followers`).then((response) => response.json()).then(setFollowers); fetch(`/api/users/${encodeURIComponent(currentProfile.username)}/following`).then((response) => response.json()).then(setFollowing); fetch(`/api/follow/is-following/${encodeURIComponent(currentProfile.username)}`, { headers: headers() }).then((response) => response.ok ? response.json() : { following: false }).then((result) => setIsFollowing(result.following)); });
  }, [username, requestedId]);

  const updatePost = (postId: number, patch: Partial<Post>) => setPosts((items) => items.map((post) => post.id === postId ? { ...post, ...patch } : post));

  const toggleFollow = async () => {
    if (!profile || profile.id === viewer.id) return;
    const response = await fetch(`/api/follow/${isFollowing ? 'unfollow' : 'follow'}/${encodeURIComponent(profile.username)}`, { method: 'POST', headers: headers() });
    if (response.ok) { setIsFollowing(!isFollowing); setFollowers((items) => isFollowing ? items.filter((item) => item.id !== viewer.id) : [...items, viewer]); }
  };

  if (!profile) return <section className="profile-empty">Perfil não encontrado.</section>;
  const ownProfile = profile.id === viewer.id;
  const joined = profile.createdAt ? new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(profile.createdAt)) : 'agosto de 2026';

  return <section className="swift-profile">
    <header className="profile-top"><button onClick={() => history.back()} aria-label="Voltar"><ArrowLeft size={19}/></button><div><strong>{profile.username}</strong><small>{posts.length} {posts.length === 1 ? 'post' : 'posts'}</small></div></header>
    <div className={`profile-cover ${profile.cover ? 'has-cover' : ''}`} style={profile.cover ? { backgroundImage: `url(${profile.cover})` } : undefined}/>
    <section className="profile-details">
      <Avatar user={profile}/>
      <div className="profile-actions">{ownProfile ? <button className="profile-edit" onClick={() => go('profile')}>Editar perfil</button> : <><button className="profile-more" aria-label="Mais opções"><MoreHorizontal size={18}/></button><button className={isFollowing ? 'profile-follow following' : 'profile-follow'} onClick={() => void toggleFollow()}>{isFollowing ? 'Seguindo' : 'Seguir'}</button></>}</div>
      <h1>{profile.username} <span className="era-tag">folklore ✦</span></h1><p className="profile-handle">@{profile.username.replace(/\s/g, '').toLowerCase()}</p>
      {profile.bio && <p className="profile-bio-text">{profile.bio}</p>}
      <p className="profile-meta">📅 Entrou em {joined}</p>
      <div className="profile-stats"><span><strong>{following.length}</strong> Seguindo</span><span><strong>{followers.length}</strong> Seguidores</span></div>
    </section>
    <nav className="profile-tabs"><button className={tab === 'posts' ? 'active' : ''} onClick={() => setTab('posts')}>Posts</button><button className={tab === 'replies' ? 'active' : ''} onClick={() => setTab('replies')}>Respostas</button><button className={tab === 'media' ? 'active' : ''} onClick={() => setTab('media')}>Mídia</button><button className={tab === 'likes' ? 'active' : ''} onClick={() => setTab('likes')}>Curtidas</button></nav>
    {tab === 'posts' ? <section className="profile-posts">{posts.length ? posts.map((post) => <article id={`post-${post.id}`} className="profile-post" key={post.id}><header><Avatar user={profile}/><div><strong>{profile.username}</strong><span className="era-tag">folklore</span><p>@{profile.username.replace(/\s/g, '').toLowerCase()} · {new Date(post.createdAt).toLocaleDateString('pt-BR')}</p></div></header><p>{post.content}</p>{post.image && <img src={post.image} alt="Imagem da publicação"/>}<ProfilePostActions post={post} onUpdate={updatePost}/></article>) : <div className="profile-empty">Ainda não há posts.</div>}</section> : <section className="profile-empty">Nada para mostrar nesta aba.</section>}
  </section>;
}
