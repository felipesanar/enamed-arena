import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { adminApi } from '../services/adminApi';
import { FileText, Users, ClipboardList, Radio, CalendarClock } from 'lucide-react';

interface Stats {
  totalSimulados: number;
  totalUsers: number;
  totalAttempts: number;
  activeSimulados: number;
  nextSimulado: { title: string; sequence_number: number; execution_window_start: string } | null;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    adminApi.getDashboardStats().then(setStats);
  }, []);

  if (!stats) {
    return <div className="flex items-center justify-center h-64"><div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  const kpis = [
    { label: 'Simulados', value: stats.totalSimulados, icon: FileText },
    { label: 'Usuários', value: stats.totalUsers, icon: Users },
    { label: 'Tentativas', value: stats.totalAttempts, icon: ClipboardList },
    { label: 'Ativos agora', value: stats.activeSimulados, icon: Radio },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {stats.nextSimulado && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">Próximo simulado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold text-foreground">#{stats.nextSimulado.sequence_number} — {stats.nextSimulado.title}</p>
            <p className="text-sm text-muted-foreground">
              {new Date(stats.nextSimulado.execution_window_start).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
