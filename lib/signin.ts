// Pure sign-in decision (tested in signin.test.ts). The choice on the sign-in screen wins:
// picking "worker" never lands anyone in staff, company or admin screens.
export type SignInDecision =
  | { kind: "worker" }
  | { kind: "admin" | "recruiter" }
  | { kind: "employer"; employerId: string }
  | { kind: "provider"; providerId: string }
  | { kind: "denied" };

export function decideSignIn(input: {
  intent: "worker" | "employer" | undefined;
  email: string | null;
  phone: string | null;
  staffRole: "admin" | "recruiter" | null;
  employerId: string | null;
  providerId: string | null;
}): SignInDecision {
  if (input.intent === "worker" || (!input.email && input.phone)) return { kind: "worker" };
  if (input.staffRole) return { kind: input.staffRole };
  if (input.employerId) return { kind: "employer", employerId: input.employerId };
  if (input.providerId) return { kind: "provider", providerId: input.providerId };
  return { kind: "denied" };
}
