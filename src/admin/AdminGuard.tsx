import { Navigate, Outlet } from 'react-router-dom';
import { useAdminAuth } from './hooks/useAdminAuth';
import { AdminAccessProvider } from './contexts/AdminAccessContext';

export function AdminGuard() {
  const { user, hasAccess, roles, capabilities, loading } = useAdminAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-admin-bg">
        <div className="h-10 w-10 border-3 border-admin-accent/30 border-t-admin-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/admin/login" replace />;
  if (!hasAccess) return (
    <div className="min-h-screen flex items-center justify-center bg-admin-bg">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold text-admin-text">Acesso negado</h1>
        <p className="text-admin-muted">Você não tem permissão para acessar o painel.</p>
      </div>
    </div>
  );

  return (
    <AdminAccessProvider roles={roles} capabilities={capabilities}>
      <Outlet />
    </AdminAccessProvider>
  );
}
