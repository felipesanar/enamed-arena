import { Outlet } from 'react-router-dom';
import { AdminSidebar } from './components/AdminSidebar';

export function AdminApp() {
  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
