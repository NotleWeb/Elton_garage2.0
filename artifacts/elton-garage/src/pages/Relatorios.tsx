import { useState } from 'react';
import { useGetMonthlyReport, useGetServicesReport } from '@workspace/api-client-react';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, DollarSign, ArrowDownRight, ArrowUpRight, TrendingUp } from 'lucide-react';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function Relatorios() {
  const currentDate = new Date();
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [year, setYear] = useState(currentDate.getFullYear());

  const { data: monthly, isLoading: monthLoading } = useGetMonthlyReport({ month, year });
  
  // Create first and last day of selected month for the services report
  const firstDay = new Date(year, month - 1, 1).toISOString();
  const lastDay = new Date(year, month, 0, 23, 59, 59).toISOString();
  
  const { data: servicesRep, isLoading: svcLoading } = useGetServicesReport({ dateFrom: firstDay, dateTo: lastDay });

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Relatórios e Métricas</h1>
          <p className="text-muted-foreground">Análise de desempenho do negócio</p>
        </div>
        
        <div className="flex gap-2 bg-card p-2 rounded-lg border border-border">
          <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
            <SelectTrigger className="w-[140px] border-none shadow-none focus:ring-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }).map((_, i) => (
                <SelectItem key={i+1} value={String(i+1)} className="capitalize">
                  {format(new Date(2020, i), 'MMMM', { locale: ptBR })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="w-px h-10 bg-border"></div>
          <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-[100px] border-none shadow-none focus:ring-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[year-2, year-1, year, year+1].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {(monthLoading || svcLoading) ? (
        <div className="flex h-64 items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between space-y-0 pb-2">
                  <p className="text-sm font-medium text-muted-foreground">Receita Bruta</p>
                  <ArrowDownRight className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-bold text-foreground">{formatCurrency(monthly?.totalRevenue || 0)}</div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between space-y-0 pb-2">
                  <p className="text-sm font-medium text-muted-foreground">Despesas</p>
                  <ArrowUpRight className="h-4 w-4 text-red-500" />
                </div>
                <div className="text-2xl font-bold text-foreground">{formatCurrency(monthly?.totalExpenses || 0)}</div>
              </CardContent>
            </Card>
            <Card className="border-border bg-primary/5">
              <CardContent className="p-6">
                <div className="flex items-center justify-between space-y-0 pb-2">
                  <p className="text-sm font-medium text-primary">Lucro Líquido</p>
                  <DollarSign className="h-4 w-4 text-primary" />
                </div>
                <div className="text-2xl font-bold text-primary">{formatCurrency(monthly?.profit || 0)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Margem: {monthly?.totalRevenue ? Math.round((monthly.profit / monthly.totalRevenue) * 100) : 0}%
                </p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between space-y-0 pb-2">
                  <p className="text-sm font-medium text-muted-foreground">Novos Clientes</p>
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                </div>
                <div className="text-2xl font-bold text-foreground">{monthly?.newCustomers || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">{monthly?.completedAppointments || 0} O.S. concluídas</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="col-span-1 lg:col-span-2 border-border">
              <CardHeader>
                <CardTitle>Receita por Dia</CardTitle>
                <CardDescription>Acompanhamento de entrada diária no mês</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthly?.revenueByDay || []}>
                      <XAxis 
                        dataKey="date" 
                        stroke="#888888" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false}
                        tickFormatter={(value) => format(new Date(value), 'dd')}
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
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="col-span-1 border-border">
              <CardHeader>
                <CardTitle>Serviços por Categoria</CardTitle>
                <CardDescription>Distribuição de receita ({servicesRep?.totalServices || 0} O.S.)</CardDescription>
              </CardHeader>
              <CardContent>
                {servicesRep?.byCategory?.length ? (
                  <div className="h-[250px] w-full flex flex-col justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={servicesRep.byCategory}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="revenue"
                          nameKey="category"
                        >
                          {servicesRep.byCategory.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                          formatter={(value: number) => [formatCurrency(value), 'Receita']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap justify-center gap-3 mt-4">
                      {servicesRep.byCategory.map((entry, index) => (
                        <div key={entry.category} className="flex items-center gap-1.5 text-xs">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                          <span className="text-muted-foreground">{entry.category}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                    Dados insuficientes
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-border">
            <CardHeader>
              <CardTitle>Serviços Mais Vendidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-border overflow-hidden">
                <div className="bg-muted/50 grid grid-cols-12 gap-4 p-3 text-sm font-medium text-muted-foreground border-b border-border">
                  <div className="col-span-6">Serviço</div>
                  <div className="col-span-3 text-center">Qtd Realizada</div>
                  <div className="col-span-3 text-right">Receita Gerada</div>
                </div>
                <div className="divide-y divide-border">
                  {!monthly?.topServices?.length ? (
                    <div className="p-8 text-center text-muted-foreground">Nenhum serviço realizado neste período.</div>
                  ) : (
                    monthly.topServices.map((srv) => (
                      <div key={srv.serviceId} className="grid grid-cols-12 gap-4 p-3 items-center hover:bg-secondary/30 transition-colors">
                        <div className="col-span-6 font-medium">{srv.serviceName}</div>
                        <div className="col-span-3 text-center">{srv.count}x</div>
                        <div className="col-span-3 text-right font-medium text-primary">{formatCurrency(srv.revenue)}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}