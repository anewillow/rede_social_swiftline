# Refatoração - 04: remover componentes não utilizados

## Contexto e problema

Durante a verificação do projeto, o compilador apontou que os componentes `SearchBar` e `PublicProfile`, declarados em `App.tsx`, nunca são utilizados. A busca exibida atualmente pertence ao componente `RightRail`, enquanto o perfil público é aberto pelo componente `SwiftProfile`.

Isso caracteriza o code smell **Código Morto**: existem duas implementações antigas no arquivo, mas nenhuma delas participa das telas executadas pelo sistema. O problema é relevante porque alguém pode alterar `PublicProfile` acreditando que está corrigindo o perfil mostrado ao usuário, quando a tela realmente utiliza `SwiftProfile`. O mesmo pode acontecer com `SearchBar`, que não controla a busca atual.

A refatoração escolhida é a **Remoção de Código Morto**, conforme o Capítulo 9 do livro *Engenharia de Software Moderna* de Marco Tulio Valente.

## Antes da refatoração

O componente `SearchBar` está declarado em `App.tsx`, mas não é chamado em nenhuma parte da aplicação:

```tsx
function SearchBar({ go }: { go: (page: Page) => void }) {
  const [value, setValue] = useState('');
  return (
    <form
      className="search"
      onSubmit={(event) => {
        event.preventDefault();
        sessionStorage.setItem('networkQuery', value);
        go('network');
      }}
    >
      <Search size={18} />
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Buscar na Swiftline"
      />
    </form>
  );
}
```

O componente `PublicProfile` também permanece declarado, mesmo que o perfil público atual seja exibido por `SwiftProfile`:

```tsx
function PublicProfile({
  viewer,
  openProfile,
}: {
  viewer: User;
  openProfile: (username: string) => void;
}) {
  const username = new URLSearchParams(location.search).get('user') || '';
  const [profile, setProfile] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followers, setFollowers] = useState<User[]>([]);
  const [following, setFollowing] = useState<User[]>([]);
  const [tab, setTab] = useState<'posts' | 'followers' | 'following'>('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  useEffect(() => {
    if (!username) return;
    fetch(`/api/users/username/${encodeURIComponent(username)}`, { headers: headers() })
      .then((response) => (response.ok ? response.json() : null))
      .then(setProfile);
    fetch(`/api/posts?username=${encodeURIComponent(username)}`, { headers: headers() })
      .then((response) => response.json())
      .then(setPosts);
    fetch(`/api/users/${encodeURIComponent(username)}/followers`)
      .then((response) => response.json())
      .then(setFollowers);
    fetch(`/api/users/${encodeURIComponent(username)}/following`)
      .then((response) => response.json())
      .then(setFollowing);
    fetch(`/api/follow/is-following/${encodeURIComponent(username)}`, { headers: headers() })
      .then((response) => (response.ok ? response.json() : { following: false }))
      .then((result) => setIsFollowing(result.following));
  }, [username]);
  const toggleFollow = async () => {
    if (!profile || profile.id === viewer.id) return;
    const response = await fetch(
      `/api/follow/${isFollowing ? 'unfollow' : 'follow'}/${encodeURIComponent(profile.username)}`,
      { method: 'POST', headers: headers() },
    );
    if (response.ok) {
      setIsFollowing(!isFollowing);
      setFollowers((items) =>
        isFollowing ? items.filter((item) => item.id !== viewer.id) : [...items, viewer],
      );
    }
  };
  if (!profile)
    return (
      <section className="page-section">
        <Empty
          title="Perfil não encontrado."
          description="Talvez esta pessoa tenha mudado de nome ou não exista mais."
        />
      </section>
    );
  const list = tab === 'followers' ? followers : following;
  return (
    <section className="public-profile">
      <header className="profile-hero">
        <Avatar person={profile} size="large" />
        <div>
          <h1>{profile.username}</h1>
          <p>@{profile.username.replace(/\s/g, '').toLowerCase()}</p>
        </div>
        {profile.id !== viewer.id && (
          <button
            id="followProfileBtn"
            className={isFollowing ? 'soft-button following' : 'soft-button'}
            onClick={() => void toggleFollow()}
          >
            {isFollowing ? 'Seguindo' : 'Seguir'}
          </button>
        )}
        <p className="profile-bio">{profile.bio || 'Ainda não escreveu uma bio.'}</p>
      </header>
      <nav className="profile-tabs">
        <button className={tab === 'posts' ? 'active' : ''} onClick={() => setTab('posts')}>
          Posts <span>{posts.length}</span>
        </button>
        <button className={tab === 'followers' ? 'active' : ''} onClick={() => setTab('followers')}>
          Seguidores <span>{followers.length}</span>
        </button>
        <button className={tab === 'following' ? 'active' : ''} onClick={() => setTab('following')}>
          Seguindo <span>{following.length}</span>
        </button>
      </nav>
      {tab === 'posts' ? (
        <section className="feed-list">
          {posts.length ? (
            posts.map((post) => (
              <article className="post tweet" key={post.id}>
                <p className="post-content">{post.content}</p>
                {post.image && (
                  <img className="post-image" src={post.image} alt="Imagem da publicação" />
                )}
                <footer>
                  <span>
                    <ThumbsUp size={16} /> {post.likes || 0}
                  </span>
                  <span>
                    <MessageSquare size={16} /> Respostas
                  </span>
                </footer>
              </article>
            ))
          ) : (
            <Empty
              title="Ainda não há posts."
              description="Quando essa pessoa postar, aparecerá aqui."
            />
          )}
        </section>
      ) : (
        <section className="profile-people">
          {list.length ? (
            list.map((person) => (
              <button key={person.id} onClick={() => openProfile(person.username)}>
                <Avatar person={person} />
                <span>
                  <strong>{person.username}</strong>
                  <small>{person.bio || 'Na Swiftline'}</small>
                </span>
              </button>
            ))
          ) : (
            <Empty
              title={tab === 'followers' ? 'Ainda não tem seguidores.' : 'Ainda não segue ninguém.'}
              description="A lista aparecerá quando houver novas conexões."
            />
          )}
        </section>
      )}
    </section>
  );
}
```

O compilador confirma que os dois componentes são código não utilizado:

```text
client/App.tsx(789,10): 'SearchBar' is declared but its value is never read.
client/App.tsx(2361,10): 'PublicProfile' is declared but its value is never read.
```

> [!WARNING]
> **Como está antes**
>
> `App.tsx` guarda duas implementações antigas que não são chamadas. Elas aumentam o arquivo e podem levar a equipe a editar o componente errado.

- [`SearchBar` antes da remoção](../../sistema/client/App.tsx#L789-L808)
- [`PublicProfile` antes da remoção](../../sistema/client/App.tsx#L2361-L2494)
- [Perfil público realmente utilizado em `App`](../../sistema/client/App.tsx#L242)

## Como a remoção resolve o problema

Serão removidas apenas as declarações de `SearchBar` e `PublicProfile`. Nenhuma chamada será substituída, porque os componentes já não são executados.

A busca atual continuará sendo realizada pelo campo de pesquisa de `RightRail`, e o perfil público continuará sendo exibido por `SwiftProfile`. Com isso, `App.tsx` deixa de apresentar duas alternativas falsas para funcionalidades que já possuem implementações ativas.

Essa é uma **refatoração oportunista**: o código morto foi percebido durante a verificação técnica das refatorações anteriores e será corrigido agora, aproveitando o trabalho realizado no mesmo projeto.

> [!IMPORTANT]
> **Antes:** existem componentes antigos sem nenhuma chamada.  
> **Depois:** permanecem somente as implementações que o sistema realmente utiliza.

## Depois da refatoração

As declarações completas de `SearchBar` e `PublicProfile` foram removidas de `App.tsx`. Não foi necessário colocar outro código no lugar, pois nenhuma parte do sistema chamava esses componentes.

A busca que já estava ativa permaneceu em `RightRail`:

```tsx
function RightRail({ openProfile }: { openProfile: (username: string) => void }) {
  // estados e carregamento dos resultados
  return (
    <aside className="right-rail">
      <form className="rail-search" onSubmit={(event) => event.preventDefault()}>
        <Search size={18} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar pessoas e posts"
          aria-label="Buscar pessoas e publicações na Swiftline"
        />
        {/* resultados da busca */}
      </form>
    </aside>
  );
}
```

O perfil público continuou sendo aberto por `SwiftProfile`:

```tsx
{page === 'userProfile' && <SwiftProfile viewer={user} go={go} />}
```

Depois da remoção, a verificação de código não apresentou mais os avisos sobre `SearchBar` e `PublicProfile`. A aplicação compilou e os nove testes automatizados existentes passaram. Na verificação manual, a busca e a troca entre perfis também foram testadas no navegador.

> [!TIP]
> **Como ficou depois**
>
> O arquivo deixou de guardar duas versões antigas. A busca continua em `RightRail` e o perfil público continua em `SwiftProfile`, sem alteração nas telas utilizadas pelo usuário.

- [Busca ativa em `RightRail`](../../sistema/client/App.tsx#L520-L745)
- [Campo de busca ativo](../../sistema/client/App.tsx#L612-L619)
- [Chamada do perfil público ativo](../../sistema/client/App.tsx#L249)
- [`SwiftProfile`](../../sistema/client/SwiftProfile.tsx#L46)

## Critérios de aceitação

- [x] `SearchBar` e `PublicProfile` foram removidos de `App.tsx`.
- [x] O compilador não aponta mais os dois componentes como não utilizados.
- [x] A aplicação continua compilando após a remoção.
- [x] A busca atual continua funcionando pelo campo exibido na lateral.
- [x] O perfil público continua sendo aberto por `SwiftProfile`.
- [x] Nenhuma tela ou ação disponível para o usuário foi removida.
- [x] O comportamento externo permanece igual após a refatoração.

## Evidência em vídeo

- [Vídeo único — antes e depois da refatoração](../evidencias/issue-04-antes-e-depois-remocao-de-codigo-morto.mp4)
