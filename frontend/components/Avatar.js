export default function Avatar({ user, large = false }) {
  const url = user?.photos?.[0]?.url;
  const cls = `avatar${large ? ' lg' : ''}`;
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={cls} src={url} alt={user.name} />;
  }
  return <div className={cls}>{(user?.name || '?').slice(0, 1).toUpperCase()}</div>;
}
