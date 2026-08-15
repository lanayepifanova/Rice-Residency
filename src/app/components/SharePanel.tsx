import { createShareLinkAction, revokeShareLinkAction } from "../events/actions";

export type ShareLinkView = {
  id: string;
  url: string;
  instanceId: string | null;
  openCount: number;
};

/**
 * Share links carry a random token rather than the event id, so a link can be
 * revoked without taking the event down, and holding one link tells you nothing
 * about any other event.
 */
export function SharePanel({
  seriesId,
  instanceId,
  links,
}: {
  seriesId: string;
  instanceId: string | null;
  links: ShareLinkView[];
}) {
  return (
    <details className="host-panel">
      <summary>Share</summary>

      <div className="share-actions">
        <form action={createShareLinkAction}>
          <input type="hidden" name="seriesId" value={seriesId} />
          <button type="submit">Create a link to the whole event</button>
        </form>

        {instanceId ? (
          <form action={createShareLinkAction}>
            <input type="hidden" name="seriesId" value={seriesId} />
            <input type="hidden" name="instanceId" value={instanceId} />
            <button type="submit">Create a link to this occurrence</button>
          </form>
        ) : null}
      </div>

      {links.length === 0 ? (
        <p className="field-hint">No share links yet.</p>
      ) : (
        <ul className="share-list">
          {links.map((link) => (
            <li key={link.id}>
              <code>{link.url}</code>
              <span className="field-hint">
                {link.instanceId ? "One occurrence" : "Whole event"} · opened {link.openCount}{" "}
                {link.openCount === 1 ? "time" : "times"}
              </span>
              <form action={revokeShareLinkAction}>
                <input type="hidden" name="seriesId" value={seriesId} />
                <input type="hidden" name="linkId" value={link.id} />
                <button type="submit">Revoke</button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <p className="field-hint">
        Anyone with a link sees the same public event page. Share previews carry the title, date,
        and location only.
      </p>
    </details>
  );
}
