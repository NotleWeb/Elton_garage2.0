import { useState } from 'react';
import { Link } from 'wouter';
import { 
  useListAppointments, useCreateAppointment, getListAppointmentsQueryKey,
  useListCustomers, useListServices, useListCustomerVehicles, useUpdateAppointmentStatus
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, Calendar, Loader2, ChevronRight, Check, X, Clock } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const appointmentSchema = z.object({
  customerId: z.coerce.number().min(1, 'Cliente obrigatório'),
  vehicleId: z.coerce.number().min(1, 'Veículo obrigatório'),
  serviceId: z.coerce.number().min(1, 'Serviço obrigatório'),
  appointmentDate: z.string().min(1, 'Data/Hora obrigatória'),
  discount: z.coerce.number().optional(),
  observations: z.string().optional()
});

type AppointmentForm = z.infer<typeof appointmentSchema>;

const STATUS_COLORS: Record<string, string> = {
  agendado: 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20',
  confirmado: 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20',
  em_andamento: 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/20',
  concluido: 'bg-primary/10 text-primary hover:bg-primary/20 border-primary/20',
  cancelado: 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20',
};

const STATUS_LABELS: Record<string, string> = {
  agendado: 'Agendado',
  confirmado: 'Confirmado',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

export default function Agendamentos() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | undefined>();
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useListAppointments({ 
    page, 
    limit: 20,
    search: debouncedSearch || undefined,
    status: statusFilter !== 'todos' ? (statusFilter as any) : undefined
  });

  const { data: customers } = useListCustomers({ limit: 100 });
  const { data: services } = useListServices({ limit: 100, active: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: vehiclesResponse } = useListCustomerVehicles(selectedCustomerId || 0, { query: { enabled: !!selectedCustomerId } as any });
  const vehicles = (vehiclesResponse as any[]) || [];

  const createMutation = useCreateAppointment();
  const statusMutation = useUpdateAppointmentStatus();

  const form = useForm<AppointmentForm>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      customerId: 0, vehicleId: 0, serviceId: 0, appointmentDate: '', discount: 0, observations: ''
    }
  });

  const onSubmit = (values: AppointmentForm) => {
    // Add :00 for seconds if not present
    let dateStr = values.appointmentDate;
    if (dateStr.length === 16) dateStr += ':00';
    
    createMutation.mutate({ data: { ...values, appointmentDate: new Date(dateStr).toISOString() } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
        toast({ title: 'Agendamento criado com sucesso!' });
        setIsCreateOpen(false);
        form.reset();
        setSelectedCustomerId(undefined);
      },
      onError: () => {
        toast({ title: 'Erro ao criar agendamento', variant: 'destructive' });
      }
    });
  };

  const handleStatusChange = (id: number, status: string) => {
    statusMutation.mutate({ id, data: { status: status as any } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
        toast({ title: 'Status atualizado com sucesso' });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Agendamentos</h1>
        
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Filtrar status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="agendado">Agendado</SelectItem>
              <SelectItem value="confirmado">Confirmado</SelectItem>
              <SelectItem value="em_andamento">Em andamento</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar cliente ou placa..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="shrink-0"><Plus className="w-4 h-4 mr-2" /> Novo Agendamento</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Criar Agendamento</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                  <FormField control={form.control} name="customerId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cliente</FormLabel>
                      <Select onValueChange={(v) => {
                        field.onChange(parseInt(v));
                        setSelectedCustomerId(parseInt(v));
                        form.setValue('vehicleId', 0); // reset vehicle
                      }} value={field.value ? String(field.value) : undefined}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {customers?.data.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="vehicleId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Veículo</FormLabel>
                      <Select onValueChange={(v) => field.onChange(parseInt(v))} value={field.value ? String(field.value) : undefined} disabled={!selectedCustomerId || vehicles.length === 0}>
                        <FormControl><SelectTrigger><SelectValue placeholder={!selectedCustomerId ? "Selecione o cliente primeiro" : vehicles.length === 0 ? "Cliente não possui veículos" : "Selecione um veículo"} /></SelectTrigger></FormControl>
                        <SelectContent>
                          {vehicles.map((v: any) => <SelectItem key={v.id} value={String(v.id)}>{v.brand} {v.model} - {v.plate}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="serviceId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Serviço</FormLabel>
                      <Select onValueChange={(v) => field.onChange(parseInt(v))} value={field.value ? String(field.value) : undefined}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione um serviço" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {services?.data.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name} ({formatCurrency(s.price)})</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="appointmentDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data e Hora</FormLabel>
                        <FormControl><Input type="datetime-local" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="discount" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Desconto (R$)</FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="observations" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl><Input placeholder="Detalhes adicionais..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                    <Button type="submit" disabled={createMutation.isPending}>Salvar Agendamento</Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-border">
        <div className="rounded-md overflow-hidden">
          <div className="bg-muted/50 grid grid-cols-12 gap-4 p-4 text-sm font-medium text-muted-foreground border-b border-border">
            <div className="col-span-3">Data/Hora</div>
            <div className="col-span-3">Cliente / Veículo</div>
            <div className="col-span-3 hidden md:block">Serviço</div>
            <div className="col-span-2 text-center">Status</div>
            <div className="col-span-1 text-right"></div>
          </div>
          
          <div className="divide-y divide-border">
            {isLoading ? (
              <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
            ) : data?.data.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Nenhum agendamento encontrado.</div>
            ) : (
              data?.data.map((apt) => (
                <div key={apt.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-secondary/30 transition-colors group">
                  <div className="col-span-3 text-sm flex flex-col gap-1">
                    <span className="font-medium text-foreground flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      {formatDateTime(apt.appointmentDate).split(' ')[0]}
                    </span>
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDateTime(apt.appointmentDate).split(' ')[1]}
                    </span>
                  </div>
                  <div className="col-span-3 flex flex-col min-w-0">
                    <span className="font-medium text-foreground truncate">{apt.customer?.name}</span>
                    <span className="text-xs text-muted-foreground truncate">{apt.vehicle?.brand} {apt.vehicle?.model} - {apt.vehicle?.plate?.toUpperCase()}</span>
                  </div>
                  <div className="col-span-3 hidden md:flex flex-col min-w-0">
                    <span className="text-sm truncate text-foreground">{apt.service?.name}</span>
                    <span className="text-xs text-primary font-medium">{formatCurrency(apt.finalPrice || apt.service?.price || 0)}</span>
                  </div>
                  <div className="col-span-2 flex justify-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="focus:outline-none">
                        <Badge variant="outline" className={`cursor-pointer ${STATUS_COLORS[apt.status]}`}>
                          {STATUS_LABELS[apt.status]}
                        </Badge>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="center">
                        {Object.entries(STATUS_LABELS).map(([val, label]) => (
                          <DropdownMenuItem 
                            key={val} 
                            onClick={() => handleStatusChange(apt.id, val)}
                            className={apt.status === val ? 'bg-secondary' : ''}
                          >
                            {apt.status === val && <Check className="w-3 h-3 mr-2 text-primary" />}
                            <span className={apt.status !== val ? 'ml-5' : ''}>{label}</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="col-span-1 text-right flex justify-end">
                    <Button variant="ghost" size="icon" asChild className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link href={`/agendamentos/${apt.id}`}>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Card>
      
      {data?.meta && data.meta.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
          <div className="flex items-center px-4 text-sm font-medium">Página {page} de {data.meta.totalPages}</div>
          <Button variant="outline" disabled={page >= data.meta.totalPages} onClick={() => setPage(p => p + 1)}>Próxima</Button>
        </div>
      )}
    </div>
  );
}