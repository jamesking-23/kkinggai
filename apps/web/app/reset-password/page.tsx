import { AuthCard, buttonStyle, Field, type SearchParams } from "../../lib/auth-ui";
import { resetPassword } from "../auth/actions";

export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const { error } = await searchParams;
  return (
    <AuthCard title="Choose a new password" error={error}>
      <form action={resetPassword}>
        <Field name="password" label="New password" type="password" autoComplete="new-password" />
        <Field
          name="confirm"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
        />
        <button type="submit" style={buttonStyle}>
          Update password
        </button>
      </form>
    </AuthCard>
  );
}
