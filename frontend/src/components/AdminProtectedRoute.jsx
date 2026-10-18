import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store";

export default function AdminProtectedRoute({ children, requireSuperAdmin = false }) {
  const { adminToken, adminUser } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!adminToken || !adminUser) {
      navigate("/admin/login");
      return;
    }
    if (requireSuperAdmin && adminUser.role !== "super_admin") {
      navigate("/admin/manage"); // logged in but not authorized for this page
    }
  }, [adminToken, adminUser]);

  if (!adminToken || !adminUser) return null;
  if (requireSuperAdmin && adminUser.role !== "super_admin") return null;

  return children;
}
