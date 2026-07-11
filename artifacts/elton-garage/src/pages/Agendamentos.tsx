import { useState } from 'react';
import { Link } from 'wouter';
import {
  useListAppointments, useCreateAppointment, getListAppointmentsQueryKey,
  useListCustomers, useCreateCustomer, getListCustomersQueryKey,
  useListServices, useListCustomerVehicles, useUpdateAppointmentStatus,
  getGetDashboardKpisQueryKey, useDeleteAppointment
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { formatCurrency, formatDateTime, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import {
  Search, Plus, Calendar, Loader2, ChevronRight, Check, Trash2, Clock,
  ChevronsUpDown, X
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const customerSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  address: z.string().optional(),
  notes: z.string().optional(),
});

type CustomerForm = z.infer<typeof customerSchema>;

const appointmentSchema = z.object({
  customerId: z.coerce.number().min(1, 'Cliente obrigatório'),
  vehicleId: z.coerce.number().min(1, 'Veículo obrigatório'),
  serviceIds: z.array(z.number()).min(1, 'Selecione ao menos 1 serviço'),
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
  const [isNewCustomerOpen, setIsNewCustomerOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [servicePickerOpen, setServicePickerOpen] = useState(false);

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
  const { data: vehiclesResponse } = useListCustomerVehicles(selectedCustomerId || 0, { query: { enabled: !!selectedCustomerId } as any });
  const vehicles = (vehiclesResponse as any[]) || [];

  const createMutation = useCreateAppointment();
  const createCustomerMutation = useCreateCustomer();
  const statusMutation = useUpdateAppointmentStatus();
  const deleteMutation = useDeleteAppointment();

  const customerForm = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: '', phone: '', whatsapp: '', email: '', address: '', notes: ''
    }
  });

  const form = useForm<AppointmentForm>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      customerId: 0, vehicleId: 0, serviceIds: [], appointmentDate: '', discount: 0, observations: ''
    }
  });

  // Live summary values
  const watchedServiceIds = form.watch('serviceIds') || [];
  const watchedDiscount = form.watch('discount') || 0;
  const selectedServices = (services?.data || []).filter(s => watchedServiceIds.includes(s.id));
  const subtotal = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const totalMinutes = selectedServices.reduce((sum, s) => sum + (s.estimatedDuration || 0), 0);
  const estimatedTotal = Math.max(0, subtotal - watchedDiscount);
  const durationHours = Math.floor(totalMinutes / 60);
  const durationMins = totalMinutes % 60;

  const onSubmit = (values: AppointmentForm) => {
    let dateStr = values.appointmentDate;
    if (dateStr.length === 16) dateStr += ':00';
    createMutation.mutate({ data: { ...values, appointmentDate: new Date(dateStr).toISOString() } as any }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardKpisQueryKey({ month: new Date().getMonth() + 1, year: new Date().getFullYear() }) });
        toast({ title: 'Agendamento criado com sucesso!' });
        setIsCreateOpen(false);
        setIsNewCustomerOpen(false);
        form.reset();
        customerForm.reset();
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
        queryClient.invalidateQueries({ queryKey: getGetDashboardKpisQueryKey({ month: new Date().getMonth() + 1, year: new Date().getFullYear() }) });
        toast({ title: 'Status atualizado com sucesso' });
      }
    });
  };

  const handleDelete = () => {
    if (confirmDeleteId == null) return;
    deleteMutation.mutate({ id: confirmDeleteId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
        toast({ title: 'Registro excluído com sucesso.' });
        setConfirmDeleteId(null);
      },
      onError: (error: any) => {
        const message = error?.data?.message || 'Erro ao excluir agendamento.';
        toast({ title: message, variant: 'destructive' });
        setConfirmDeleteId(null);
      }
    });
  };

  const toggleService = (id: number, currentIds: number[], onChange: (v: number[]) => void) => {
    onChange(currentIds.includes(id) ? currentIds.filter(v => v !== id) : [...currentIds, id]);
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
              placeholder="Buscar cliente, placa ou serviço..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Dialog open={isCreateOpen} onOpenChange={(open) => {
            setIsCreateOpen(open);
            if (!open) { form.reset(); setSelectedCustomerId(undefined); }
          }}>
            <DialogTrigger asChild>
              <Button className="shrink-0"><Plus className="w-4 h-4 mr-2" /> Novo Agendamento</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Criar Agendamento</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">

                  {/* Cliente */}
                  <FormField control={form.control} name="customerId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cliente</FormLabel>
                      <Select onValueChange={(v) => {
                        field.onChange(parseInt(v));
                        setSelectedCustomerId(parseInt(v));
                        form.setValue('vehicleId', 0);
                      }} value={field.value ? String(field.value) : undefined}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {customers?.data.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setIsNewCustomerOpen((open) => !open)}>
                        {isNewCustomerOpen ? 'Fechar novo cliente' : 'Cadastrar novo cliente'}
                      </Button>
                    </FormItem>
                  )} />

                  {isNewCustomerOpen && (
                    <div className="rounded-lg border border-border bg-secondary/50 p-4 space-y-4">
                      <h2 className="text-sm font-semibold">Novo cliente</h2>
                      <Form {...customerForm}>
                        <div className="grid gap-4">
                          <FormField control={customerForm.control} name="name" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nome</FormLabel>
                              <FormControl><Input {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <div className="grid grid-cols-2 gap-4">
                            <FormField control={customerForm.control} name="phone" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Telefone</FormLabel>
                                <FormControl><Input {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <FormField control={customerForm.control} name="whatsapp" render={({ field }) => (
                              <FormItem>
                                <FormLabel>WhatsApp</FormLabel>
                                <FormControl><Input {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField control={customerForm.control} name="email" render={({ field }) => (
                              <FormItem>
                                <FormLabel>E-mail</FormLabel>
                                <FormControl><Input {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <FormField control={customerForm.control} name="address" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Endereço</FormLabel>
                                <FormControl><Input {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                          </div>
                          <FormField control={customerForm.control} name="notes" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Observações</FormLabel>
                              <FormControl><Input {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <div className="flex gap-2 justify-end">
                            <Button type="button" variant="outline" onClick={() => setIsNewCustomerOpen(false)}>Cancelar</Button>
                            <Button type="button" onClick={() => {
                              customerForm.handleSubmit((values) => {
                                createCustomerMutation.mutate({ data: values }, {
                                  onSuccess: (customer) => {
                                    queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
                                    toast({ title: 'Cliente criado com sucesso!' });
                                    setSelectedCustomerId(customer.id);
                                    form.setValue('customerId', customer.id);
                                    setIsNewCustomerOpen(false);
                                  },
                                  onError: () => {
                                    toast({ title: 'Erro ao criar cliente', variant: 'destructive' });
                                  }
                                });
                              })();
                            }}>Salvar cliente</Button>
                          </div>
                        </div>
                      </Form>
                    </div>
                  )}

                  {/* Veículo */}
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

                  {/* Serviços (multi-select) */}
                  <FormField control={form.control} name="serviceIds" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Serviços</FormLabel>
                      <div className="space-y-2">
                        {/* Selected chips */}
                        {field.value.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {field.value.map(id => {
                              const svc = services?.data.find(s => s.id === id);
                              return svc ? (
                                <Badge key={id} variant="secondary" className="flex items-center gap-1 pl-2.5 pr-1 py-1 text-xs">
                                  {svc.name}
                                  <button
                                    type="button"
                                    className="ml-0.5 rounded hover:text-destructive transition-colors"
                                    onClick={() => field.onChange(field.value.filter(v => v !== id))}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ) : null;
                            })}
                          </div>
                        )}
                        {/* Picker */}
                        <Popover open={servicePickerOpen} onOpenChange={setServicePickerOpen}>
                          <PopoverTrigger asChild>
                            <Button type="button" variant="outline" className="w-full justify-between font-normal text-muted-foreground hover:text-foreground">
                              {field.value.length === 0
                                ? "Pesquisar e adicionar serviços..."
                                : `${field.value.length} serviço(s) — adicionar mais`}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[480px] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Pesquisar serviço..." />
                              <CommandList>
                                <CommandEmpty>Nenhum serviço encontrado.</CommandEmpty>
                                <CommandGroup>
                                  {services?.data.map(s => {
                                    const selected = field.value.includes(s.id);
                                    return (
                                      <CommandItem
                                        key={s.id}
                                        value={s.name}
                                        onSelect={() => toggleService(s.id, field.value, field.onChange)}
                                      >
                                        <Check className={cn("mr-2 h-4 w-4", selected ? "opacity-100 text-primary" : "opacity-0")} />
                                        <span className="flex-1">{s.name}</span>
                                        {s.category && (
                                          <span className="text-xs text-muted-foreground mr-3">{s.category}</span>
                                        )}
                                        <span className="text-sm font-medium text-primary">{formatCurrency(s.price)}</span>
                                      </CommandItem>
                                    );
                                  })}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Data, Desconto */}
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
                        <FormControl><Input type="number" step="0.01" min="0" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  {/* Observações */}
                  <FormField control={form.control} name="observations" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl><Input placeholder="Detalhes adicionais..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Resumo em tempo real */}
                  {watchedServiceIds.length > 0 && (
                    <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-1.5 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Serviços selecionados:</span>
                        <span className="font-medium text-foreground">{selectedServices.length}</span>
                      </div>
                      {totalMinutes > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>Tempo estimado:</span>
                          <span className="font-medium text-foreground">
                            {durationHours > 0 ? `${durationHours}h ` : ''}{durationMins > 0 ? `${durationMins}min` : ''}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-muted-foreground">
                        <span>Subtotal:</span>
                        <span className="font-medium text-foreground">{formatCurrency(subtotal)}</span>
                      </div>
                      {watchedDiscount > 0 && (
                        <div className="flex justify-between text-emerald-500">
                          <span>Desconto:</span>
                          <span>-{formatCurrency(watchedDiscount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-semibold pt-1.5 border-t border-border">
                        <span>Total:</span>
                        <span className="text-primary">{formatCurrency(estimatedTotal)}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Salvar Agendamento
                    </Button>
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
            <div className="col-span-3 hidden md:block">Serviços</div>
            <div className="col-span-2 text-center">Status</div>
            <div className="col-span-1"></div>
          </div>

          <div className="divide-y divide-border">
            {isLoading ? (
              <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
            ) : data?.data.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Nenhum agendamento encontrado.</div>
            ) : (
              data?.data.map((apt) => {
                const aptServices = (apt as any).services as any[] | undefined;
                const firstService = aptServices?.[0];
                const extraCount = (aptServices?.length || 0) - 1;

                return (
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
                      <span className="text-sm truncate text-foreground">
                        {firstService?.name || '—'}
                        {extraCount > 0 && (
                          <span className="ml-1.5 text-xs text-muted-foreground font-normal">+{extraCount}</span>
                        )}
                      </span>
                      <span className="text-xs text-primary font-medium">{formatCurrency(apt.finalPrice || 0)}</span>
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
                    <div className="col-span-1 text-right flex justify-end items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setConfirmDeleteId(apt.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" asChild className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8">
                        <Link href={`/agendamentos/${apt.id}`}>
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })
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

      <ConfirmDeleteDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => { if (!open) setConfirmDeleteId(null); }}
        onConfirm={handleDelete}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
