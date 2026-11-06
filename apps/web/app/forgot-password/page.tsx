import { AuthCard, buttonStyle, Field, type SearchParams } from "../../lib/auth-ui";
import { forgotPassword } from "../auth/actions";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const { error } = await searchParams;
  return (
    <AuthCard
      title="Reset your password"
      error={error}
      footer={<a href="/login">Back to sign in</a>}
    >
      <form action={forgotPassword}>
        <Field name="email" label="Email" type="email" autoComplete="email" />
        <button type="submit" style={buttonStyle}>
          Send reset link
        </button>
      </form>
    </AuthCard>
  );
}
