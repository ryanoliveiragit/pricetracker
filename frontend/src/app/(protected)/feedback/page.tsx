import { RoleGuard } from "@/components/auth/RoleGuard";
import FeedbackAdminView from "@/views/FeedbackAdminView";

export default function FeedbackPage() {
  return (
    <RoleGuard roles={["admin"]}>
      <FeedbackAdminView />
    </RoleGuard>
  );
}
