import { 
  useGetDashboardKpis, 
  useGetRevenueByDay, 
  useGetTopServices, 
  useGetUpcomingAppointments,
  useGetCustomersNeedingService
} from '@workspace/api-client-react';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  DollarSign, TrendingUp, Calendar as CalendarIcon, 
  Car, PackageX, Loader2
} from 'lucide-react';

export default function Dashboard() {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  const { data: kpis, isLoading: kpisLoading } = useGetDashboardKpis({ month: currentMonth, year: currentYear });
  const { data: revenueByDay } = useGetRevenueByDay({ month: currentMonth, year: currentYear });
  const { data: topServices } = useGetTopServices({ month: currentMonth, year: currentYear, limit: 5 });
  const { data: upcoming } = useGetUpcomingAppointments({ limit: 5 });
  const { data: needingService } = useGetCustomersNeedingService({ days: 90, limit: 5 });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      agendado: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      confirmado: 'bg-green-500/10 text-green-500 border-green-500/20',
      em_andamento: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      concluido: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      cancelado: 'bg-red-500/10 text-red-500 border-red-500/20',
    };
    return colors[status] || 'bg-gray-500/10 text-gray-500';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      agendado: 'Agendado',
      confirmado: 'Confirmado',
      em_andamento: 'Em andamento',
      concluido: 'Concluído',
      cancelado: 'Cancelado',
    };
    return labels[status] || status;
  };

  if (kpisLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground capitalize">
          {format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita do Mês</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis?.monthlyRevenue || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className={kpis?.revenueGrowth && kpis.revenueGrowth > 0 ? "text-emerald-500" : "text-red-500"}>
                {kpis?.revenueGrowth && kpis.revenueGrowth > 0 ? "+" : ""}{kpis?.revenueGrowth?.toFixed(1) || 0}%
              </span> em relação ao mês anterior
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lucro do Mês</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis?.monthlyProfit || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Ticket médio: {formatCurrency(kpis?.averageTicket || 0)}</p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agendamentos</CardTitle>
            <CalendarIcon className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.completedAppointments || 0} / {kpis?.totalAppointments || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">{kpis?.pendingAppointments || 0} pendentes</p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atendimentos</CardTitle>
            <Car className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.vehiclesServiced || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">+{kpis?.newCustomers || 0} novos clientes</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
        <Card className="col-span-1 lg:col-span-4 border-border shadow-sm">
          <CardHeader>
            <CardTitle>Receita por Dia</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByDay || []}>
                  <XAxis 
                    dataKey="date" 
                    stroke="#888888" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(value) => format(new Date(value), 'dd/MM')}
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `R$ ${value}`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                    itemStyle={{ color: '#fafafa' }}
                    formatter={(value: number) => [formatCurrency(value), 'Receita']}
                    labelFormatter={(label) => format(new Date(label), 'dd/MM/yyyy')}
                  />
                  <Bar dataKey="revenue" fill="currentColor" radius={[4, 4, 0, 0]} className="fill-primary" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 lg:col-span-3 border-border shadow-sm">
          <CardHeader>
            <CardTitle>Top 5 Serviços</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {topServices?.map((service, index) => (
                <div key={index} className="flex items-center">
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none text-foreground">{service.serviceName}</p>
                    <p className="text-xs text-muted-foreground">{service.count} realizados</p>
                  </div>
                  <div className="font-medium text-primary">{formatCurrency(service.revenue)}</div>
                </div>
              ))}
              {!topServices?.length && (
                <div className="text-sm text-muted-foreground text-center py-4">Nenhum dado disponível</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle>Próximos Agendamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {(upcoming as any[])?.map((apt: any) => (
                <div key={apt.id} className="flex items-center gap-4">
                  <div className="bg-secondary p-3 rounded-full shrink-0">
                    <Car className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-medium leading-none truncate">{apt.customer?.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {apt.vehicle?.brand} {apt.vehicle?.model} • {format(new Date(apt.appointmentDate), "dd/MM 'às' HH:mm")}
                    </p>
                  </div>
                  <Badge variant="outline" className={getStatusColor(apt.status)}>
                    {getStatusLabel(apt.status)}
                  </Badge>
                </div>
              ))}
              {!(upcoming as any[])?.length && (
                <div className="text-sm text-muted-foreground text-center py-4">Nenhum agendamento próximo</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle>Atenção Necessária</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {kpis?.lowStockProducts !== undefined && kpis.lowStockProducts > 0 && (
                <div className="flex items-center gap-4">
                  <div className="bg-red-500/10 p-3 rounded-full shrink-0">
                    <PackageX className="w-4 h-4 text-red-500" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none text-red-500">Estoque Baixo</p>
                    <p className="text-xs text-muted-foreground">{kpis.lowStockProducts} produtos abaixo do mínimo</p>
                  </div>
                </div>
              )}
              
              {/* Note: The schema for needingService usually returns standard customer objects, assuming 'id' and 'name' are present */}
              {needingService?.map((customer: any) => (
                <div key={customer.id || customer.customerId} className="flex items-center gap-4">
                  <Avatar className="h-10 w-10 border border-border shrink-0">
                    <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                      {String(customer.name || customer.customerName || 'C').substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-medium leading-none truncate">{customer.name || customer.customerName}</p>
                    <p className="text-xs text-muted-foreground">
                      Último serviço: {customer.lastServiceDate ? format(new Date(customer.lastServiceDate), 'dd/MM/yyyy') : 'N/A'}
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                    Contatar
                  </Badge>
                </div>
              ))}
              {!needingService?.length && kpis?.lowStockProducts === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">Tudo em dia!</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}