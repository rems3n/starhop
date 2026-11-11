/** Redirect for old routes that keeps the query string and hash (owner: IA/course engineer). */
import { Navigate, useLocation, useParams } from 'react-router-dom';

/** `to` gets the route params (incl. the splat '*'); the current query string is merged in (target's own params win). */
export function Redirect({ to }: { to: (p: Record<string, string | undefined>) => string }) {
  const params = useParams();
  const { search, hash } = useLocation();
  const [path, q = ''] = to(params).split('?');
  const merged = new URLSearchParams(q);
  new URLSearchParams(search).forEach((v, k) => !merged.has(k) && merged.set(k, v));
  const qs = merged.toString();
  return <Navigate to={`${path}${qs ? `?${qs}` : ''}${hash}`} replace />;
}
