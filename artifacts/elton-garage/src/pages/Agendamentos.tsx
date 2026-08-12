import { useState } from 'react';
import { Link } from 'wouter';
import {
  useListAppointments, useCreateAppointment, getListAppointmentsQueryKey,
  useListCustomers, useCreateCustomer, getListCustomersQueryKey,
  useCreateVehicle, useListServices, useListCustomerVehicles, getListCustomerVehiclesQueryKey, useUpdateAppointmentStatus,
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
  vehicleBrand: z.string().optional(),
  vehicleModel: z.string().optional(),
  vehicleYear: z.coerce.number().optional(),
  vehiclePlate: z.string().optional(),
  vehicleColor: z.string().optional(),
  vehicleFuel: z.enum(['gasolina', 'etanol', 'flex', 'diesel', 'gnv', 'eletrico', 'hibrido']).optional(),
  vehicleNotes: z.string().optional(),
}).refine((values) => {
  const hasAnyVehicleField = Boolean(
    values.vehicleBrand ||
    values.vehicleModel ||
    values.vehicleYear ||
    values.vehiclePlate ||
    values.vehicleColor ||
    values.vehicleFuel ||
    values.vehicleNotes
  );
  if (!hasAnyVehicleField) return true;
  return Boolean(values.vehicleBrand && values.vehicleModel);
}, {
  message: 'Para cadastrar veículo junto, informe ao menos marca e modelo',
  path: ['vehicleBrand'],
});

type CustomerForm = z.infer<typeof customerSchema>;

const appointmentSchema = z.object({
  customerId: z.coerce.number().min(1, 'Cliente obrigatório'),
  vehicleId: z.coerce.number().min(1, 'Veículo obrigatório'),
  serviceIds: z.array(z.number()).min(1, 'Selecione ao menos 1 serviço'),
  appointmentDate: z.string().min(1, 'Data/Hora obrigatória').refine((value) => {
    const normalized = value.length === 16 ? `${value}:00` : value;
    const d = new Date(normalized);
    if (Number.isNaN(d.getTime())) return false;
    const mins = d.getMinutes();
    return (mins === 0 || mins === 30) && d.getSeconds() === 0;
  }, 'Horário deve estar em intervalos de 30 minutos (HH:00 ou HH:30)'),
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

const CATEGORY_ORDER = ['lavagem', 'polimento', 'higienizacao', 'estetica', 'outros'];
const CATEGORY_LABELS: Record<string, string> = {
  lavagem: 'Lavagem',
  polimento: 'Polimento',
  higienizacao: 'Higienização',
  estetica: 'Estética',
  outros: 'Outros',
};

function normalizeCategory(category?: string): string {
  if (!category) return 'outros';
  const normalized = category
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (normalized.includes('lavagem')) return 'lavagem';
  if (normalized.includes('polimento')) return 'polimento';
  if (normalized.includes('higienizacao')) return 'higienizacao';
  if (normalized.includes('estetica')) return 'estetica';
  return 'outros';
}

function displayPlate(plate?: string | null): string {
  if (!plate) return 'Sem placa';
  if (/^enc:v1:/i.test(plate)) return 'Sem placa';
  return plate.toUpperCase();
}

function cleanVehicleText(value?: string | null): string {
  if (!value) return '';
  if (/^enc:v1:/i.test(value)) return '';
  return value;
}

export default function Agendamentos() {
  const currentDate = new Date();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [year, setYear] = useState(currentDate.getFullYear());
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | undefined>();
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [isNewCustomerOpen, setIsNewCustomerOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [servicePickerOpen, setServicePickerOpen] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const monthStart = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
  const monthLastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(monthLastDay).padStart(2, '0')}`;
  const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
    .format(new Date(year, month - 1, 1));

  const { data, isLoading } = useListAppointments({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    status: statusFilter !== 'todos' ? (statusFilter as any) : undefined,
    dateFrom: monthStart,
    dateTo: monthEnd,
  });

  const totalAppointments = data?.meta?.total ?? data?.data.length ?? 0;

  const { data: customers } = useListCustomers({ limit: 100 });
  const { data: services } = useListServices({ limit: 100, active: true });
  const { data: vehiclesResponse } = useListCustomerVehicles(selectedCustomerId || 0, { query: { enabled: !!selectedCustomerId } as any });
  const vehicles = (vehiclesResponse as any[]) || [];
  const customerOptions = [...(customers?.data || [])].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  const createMutation = useCreateAppointment();
  const createCustomerMutation = useCreateCustomer();
  const createVehicleMutation = useCreateVehicle();
  const statusMutation = useUpdateAppointmentStatus();
  const deleteMutation = useDeleteAppointment();

  const customerForm = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: '', phone: '', whatsapp: '', email: '', address: '', notes: '',
      vehicleBrand: '', vehicleModel: '', vehiclePlate: '', vehicleColor: '', vehicleFuel: undefined, vehicleNotes: ''
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
  const allServices = services?.data || [];
  const servicesByCategory = allServices.reduce((acc, service) => {
    const key = normalizeCategory(service.category);
    if (!acc[key]) acc[key] = [];
    acc[key].push(service);
    return acc;
  }, {} as Record<string, typeof allServices>);
  const orderedCategoryKeys = Object.keys(servicesByCategory).sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a);
    const bi = CATEGORY_ORDER.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

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
      onError: (error: any) => {
        const message = error?.data?.message || 'Erro ao criar agendamento';
        toast({ title: message, variant: 'destructive' });
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
    <div className="page-shell">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Agendamentos</h1>
          <Badge variant="secondary" className="rounded-full px-3 py-1 text-sm font-medium">
            {totalAppointments} {totalAppointments === 1 ? 'agendamento' : 'agendamentos'}
          </Badge>
        </div>

        <div className="page-actions gap-3">
          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5">
            <span className="text-sm font-medium capitalize">{monthLabel}</span>
            <Select value={String(month)} onValueChange={(v) => { setMonth(parseInt(v)); setPage(1); }}>
              <SelectTrigger className="h-8 w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }).map((_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)} className="capitalize">
                    {new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(2020, i, 1))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(v) => { setYear(parseInt(v)); setPage(1); }}>
              <SelectTrigger className="h-8 w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[year - 2, year - 1, year, year + 1, year + 2].map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
            if (!open) {
              form.reset();
              setSelectedCustomerId(undefined);
              setCustomerPickerOpen(false);
            }
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
                      <Popover open={customerPickerOpen} onOpenChange={setCustomerPickerOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              type="button"
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between font-normal"
                            >
                              {field.value
                                ? (customerOptions.find((c) => c.id === field.value)?.name || 'Selecione um cliente')
                                : 'Selecione um cliente'}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Buscar cliente..." />
                            <CommandList className="max-h-64 overflow-y-auto">
                              <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                              <CommandGroup heading="Clientes">
                                {customerOptions.map((c) => {
                                  const selected = field.value === c.id;
                                  return (
                                    <CommandItem
                                      key={c.id}
                                      value={`${c.name} ${c.phone || ''} ${c.whatsapp || ''}`}
                                      onSelect={() => {
                                        field.onChange(c.id);
                                        setSelectedCustomerId(c.id);
                                        form.setValue('vehicleId', 0);
                                        setCustomerPickerOpen(false);
                                      }}
                                    >
                                      <Check className={cn('mr-2 h-4 w-4', selected ? 'opacity-100 text-primary' : 'opacity-0')} />
                                      <span className="truncate">{c.name}</span>
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
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

                          <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-4">
                            <h3 className="text-sm font-semibold text-foreground">Cadastrar veículo junto (opcional)</h3>
                            <div className="grid grid-cols-2 gap-4">
                              <FormField control={customerForm.control} name="vehicleBrand" render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Marca</FormLabel>
                                  <FormControl><Input placeholder="Ex: VW" {...field} /></FormControl>
                                  <FormMessage />
                                </FormItem>
                              )} />
                              <FormField control={customerForm.control} name="vehicleModel" render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Modelo</FormLabel>
                                  <FormControl><Input placeholder="Ex: Polo" {...field} /></FormControl>
                                  <FormMessage />
                                </FormItem>
                              )} />
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                              <FormField control={customerForm.control} name="vehicleYear" render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Ano</FormLabel>
                                  <FormControl><Input type="number" {...field} value={field.value || ''} /></FormControl>
                                  <FormMessage />
                                </FormItem>
                              )} />
                              <FormField control={customerForm.control} name="vehiclePlate" render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Placa</FormLabel>
                                  <FormControl><Input placeholder="ABC-1234" {...field} className="uppercase" /></FormControl>
                                  <FormMessage />
                                </FormItem>
                              )} />
                              <FormField control={customerForm.control} name="vehicleColor" render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Cor</FormLabel>
                                  <FormControl><Input {...field} /></FormControl>
                                  <FormMessage />
                                </FormItem>
                              )} />
                            </div>
                            <FormField control={customerForm.control} name="vehicleFuel" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Combustível</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                                  <SelectContent>
                                    <SelectItem value="gasolina">Gasolina</SelectItem>
                                    <SelectItem value="etanol">Etanol</SelectItem>
                                    <SelectItem value="flex">Flex</SelectItem>
                                    <SelectItem value="diesel">Diesel</SelectItem>
                                    <SelectItem value="gnv">GNV</SelectItem>
                                    <SelectItem value="eletrico">Elétrico</SelectItem>
                                    <SelectItem value="hibrido">Híbrido</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <FormField control={customerForm.control} name="vehicleNotes" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Observações do veículo</FormLabel>
                                <FormControl><Input {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                          </div>

                          <div className="flex gap-2 justify-end">
                            <Button type="button" variant="outline" onClick={() => setIsNewCustomerOpen(false)}>Cancelar</Button>
                            <Button type="button" disabled={createCustomerMutation.isPending || createVehicleMutation.isPending} onClick={() => {
                              customerForm.handleSubmit(async (values) => {
                                const {
                                  vehicleBrand,
                                  vehicleModel,
                                  vehicleYear,
                                  vehiclePlate,
                                  vehicleColor,
                                  vehicleFuel,
                                  vehicleNotes,
                                  ...customerData
                                } = values;

                                const brand = vehicleBrand?.trim();
                                const model = vehicleModel?.trim();
                                const shouldCreateVehicle = Boolean(brand && model);

                                try {
                                  const customer = await createCustomerMutation.mutateAsync({ data: customerData as any });
                                  queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
                                  setSelectedCustomerId(customer.id);
                                  form.setValue('customerId', customer.id);

                                  if (shouldCreateVehicle) {
                                    const vehicle = await createVehicleMutation.mutateAsync({
                                      data: {
                                        customerId: customer.id,
                                        brand: brand!,
                                        model: model!,
                                        year: vehicleYear,
                                        plate: vehiclePlate,
                                        color: vehicleColor,
                                        fuel: vehicleFuel,
                                        notes: vehicleNotes,
                                      } as any
                                    });
                                    queryClient.invalidateQueries({ queryKey: getListCustomerVehiclesQueryKey(customer.id) });
                                    form.setValue('vehicleId', vehicle.id);
                                    toast({ title: 'Cliente e veículo criados com sucesso!' });
                                  } else {
                                    form.setValue('vehicleId', 0);
                                    toast({ title: 'Cliente criado com sucesso!' });
                                  }

                                  customerForm.reset();
                                  setIsNewCustomerOpen(false);
                                } catch {
                                  toast({ title: 'Erro ao criar cliente', variant: 'destructive' });
                                }
                              })();
                            }}>
                              {(createCustomerMutation.isPending || createVehicleMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                              Salvar cliente
                            </Button>
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
                          {vehicles.map((v: any) => <SelectItem key={v.id} value={String(v.id)}>{`${cleanVehicleText(v.brand)} ${cleanVehicleText(v.model)}`.trim()} - {displayPlate(v.plate)}</SelectItem>)}
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
                          <PopoverContent className="w-full max-w-[min(100vw,24rem)] md:max-w-[480px] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Pesquisar serviço..." />
                              <CommandList>
                                <CommandEmpty>Nenhum serviço encontrado.</CommandEmpty>
                                {orderedCategoryKeys.map((categoryKey) => (
                                  <CommandGroup key={categoryKey} heading={CATEGORY_LABELS[categoryKey] || 'Outros'}>
                                    {servicesByCategory[categoryKey].map(s => {
                                      const selected = field.value.includes(s.id);
                                      return (
                                        <CommandItem
                                          key={s.id}
                                          value={`${s.name} ${s.category || ''}`}
                                          onSelect={() => toggleService(s.id, field.value, field.onChange)}
                                        >
                                          <Check className={cn("mr-2 h-4 w-4", selected ? "opacity-100 text-primary" : "opacity-0")} />
                                          <span className="flex-1">{s.name}</span>
                                          <span className="text-sm font-medium text-primary">{formatCurrency(s.price)}</span>
                                        </CommandItem>
                                      );
                                    })}
                                  </CommandGroup>
                                ))}
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
                        <FormControl><Input type="datetime-local" step={1800} {...field} /></FormControl>
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
          <div className="bg-muted/50 hidden md:grid grid-cols-12 gap-4 p-4 text-sm font-medium text-muted-foreground border-b border-border">
            <div className="col-span-3">Data/Hora</div>
            <div className="col-span-3">Cliente / Veículo</div>
            <div className="col-span-3">Serviços / Valor</div>
            <div className="col-span-2 text-center">Status</div>
            <div className="col-span-1"></div>
          </div>

          <div className="space-y-4">
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
                  <div key={apt.id} className="rounded-3xl border border-border bg-secondary/10 p-4 shadow-sm transition-colors hover:bg-secondary/20 group">
                    <div className="grid gap-3 md:grid-cols-12 md:items-center">
                      <div className="md:col-span-3 space-y-1">
                        <div className="text-sm font-semibold text-foreground">{formatDateTime(apt.appointmentDate)}</div>
                        <div className="text-xs text-muted-foreground">{apt.customer?.name || '-'} • {cleanVehicleText(apt.vehicle?.brand)} {cleanVehicleText(apt.vehicle?.model)} {displayPlate(apt.vehicle?.plate)}</div>
                      </div>
                      <div className="md:col-span-3">
                        <div className="text-sm font-medium text-foreground">{firstService?.name || '—'}</div>
                        {extraCount > 0 && <div className="text-xs text-muted-foreground">+{extraCount} serviço(s)</div>}
                        <div className="text-xs text-muted-foreground mt-2 md:mt-1">Total: <span className="font-semibold text-primary">{formatCurrency(apt.finalPrice || 0)}</span></div>
                      </div>
                      <div className="md:col-span-3 flex flex-col gap-1">
                        <span className="text-sm font-medium text-foreground">Status</span>
                        <Badge variant="outline" className={`w-fit ${STATUS_COLORS[apt.status]}`}>
                          {STATUS_LABELS[apt.status]}
                        </Badge>
                      </div>
                      <div className="md:col-span-3 flex flex-wrap items-center justify-end gap-2">
                        <span className="text-xs text-muted-foreground">Cliente</span>
                        <span className="text-sm text-foreground">{apt.customer?.name || '-'}</span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 md:justify-end">
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>{formatDateTime(apt.appointmentDate).split(' ')[1]}</span>
                        <span>•</span>
                        <span>{displayPlate(apt.vehicle?.plate)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setConfirmDeleteId(apt.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" asChild className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity h-9 w-9">
                          <Link href={`/agendamentos/${apt.id}`}>
                            <ChevronRight className="w-5 h-5 text-muted-foreground" />
                          </Link>
                        </Button>
                      </div>
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
