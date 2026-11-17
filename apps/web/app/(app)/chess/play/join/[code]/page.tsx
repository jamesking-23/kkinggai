import { requireModule } from "../../../../../../lib/modules";
import { getAppContext } from "../../../../../../lib/session";
import { INVITE_CODE } from "../../../../../../lib/mp";
import type { FlashParams } from "../../../../../../lib/form";
import { Card, Flash, PageHeader, primaryButton } from "../../../../../../components/ui";
import { joinGame } from "../../actions";

/** Opening the link changes nothing: joining needs a click, so link previews cannot take the seat. */
export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<FlashParams>;
}) {
  const ctx = await getAppContext();
  requireModule(ctx, "chess");
  const { code } = await params;
  const { error, message } = await searchParams;
  const valid = INVITE_CODE.test(code);
  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Join a game" />
      <Flash error={error} message={message} />
      <Card>
        {valid ? (
          <form action={joinGame} className="space-y-3">
            <input type="hidden" name="code" value={code} />
            <p className="text-sm">You have been invited to a chess game.</p>
            <button className={primaryButton}>Join game</button>
          </form>
        ) : (
          <p className="text-sm">This invite link is not valid.</p>
        )}
      </Card>
    </div>
  );
}
