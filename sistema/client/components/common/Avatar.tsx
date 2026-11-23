export function Avatar({
  person,
  size = 'normal',
}: {
  person?: { username?: string; author?: string; avatar?: string | null };
  size?: 'normal' | 'large';
}) {
  const name = person?.username || person?.author || 'S';
  return person?.avatar ? (
    <img
      className={`avatar ${size === 'large' ? 'avatar-large' : ''}`}
      src={person.avatar}
      alt=""
    />
  ) : (
    <span className={`avatar avatar-fallback ${size === 'large' ? 'avatar-large' : ''}`}>
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}
