import { getAppContext } from "../../../lib/session";
import { updateProfile } from "../actions";

type SearchParams = Promise<{ error?: string; message?: string }>;

export default async function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await getAppContext();
  const { error, message } = await searchParams;

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-1 text-sm text-muted">Signed in as {ctx.email}</p>
      <p className="mt-1 text-sm">
        <a href="/settings/modules" className="text-primary">
          Manage modules
        </a>
      </p>

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-4 text-sm text-success">
          {message}
        </p>
      )}

      <form
        action={updateProfile}
        className="mt-6 space-y-4 rounded-lg border border-border bg-surface p-6"
      >
        <label className="block text-sm">
          Name
          <input
            name="displayName"
            defaultValue={ctx.displayName}
            required
            maxLength={80}
            className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Time zone
          <input
            name="timezone"
            defaultValue={ctx.timezone}
            required
            list="timezones"
            className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2"
          />
          <datalist id="timezones">
            {Intl.supportedValuesOf("timeZone").map((tz) => (
              <option key={tz} value={tz} />
            ))}
          </datalist>
        </label>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white"
        >
          Save changes
        </button>
      </form>
    </div>
  );
}
