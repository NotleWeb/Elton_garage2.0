import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useListCustomers, useCreateCustomer, useCreateVehicle, useDeleteCustomer, getListCustomersQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { Search, Plus, Loader2, ChevronRight, Phone, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';

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

export default function Clientes() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useListCustomers({ 
    page, 
    limit: 20, 
    search: debouncedSearch || undefined,
    sortBy: 'name',
    sortOrder: 'asc'
  });

  const createMutation = useCreateCustomer();
  const createVehicleMutation = useCreateVehicle();
  const deleteMutation = useDeleteCustomer();

  const form = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: '', phone: '', whatsapp: '', email: '', address: '', notes: '',
      vehicleBrand: '', vehicleModel: '', vehiclePlate: '', vehicleColor: '', vehicleFuel: undefined, vehicleNotes: ''
    }
  });

  const onSubmit = (values: CustomerForm) => {
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

    const vehicleBrandValue = vehicleBrand?.trim();
    const vehicleModelValue = vehicleModel?.trim();
    const shouldCreateVehicle = Boolean(vehicleBrandValue && vehicleModelValue);

    createMutation.mutate({ data: customerData }, {
      onSuccess: async (createdCustomer: any) => {
        if (shouldCreateVehicle) {
          try {
            await createVehicleMutation.mutateAsync({
              data: {
                customerId: createdCustomer.id,
                brand: vehicleBrandValue!,
                model: vehicleModelValue!,
                year: vehicleYear,
                plate: vehiclePlate,
                color: vehicleColor,
                fuel: vehicleFuel,
                notes: vehicleNotes,
              }
            });
            toast({ title: 'Cliente e veículo cadastrados com sucesso!' });
          } catch {
            toast({ title: 'Cliente cadastrado, mas houve erro ao cadastrar o veículo', variant: 'destructive' });
          }
        } else {
          toast({ title: 'Cliente cadastrado com sucesso!' });
        }

        queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
        setIsCreateOpen(false);
        form.reset();
      },
      onError: () => {
        toast({ title: 'Erro ao cadastrar cliente', variant: 'destructive' });
      }
    });
  };

  const handleDelete = () => {
    if (confirmDeleteId == null) return;
    deleteMutation.mutate({ id: confirmDeleteId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
        toast({ title: 'Registro excluído com sucesso.' });
        setConfirmDeleteId(null);
      },
      onError: (error: any) => {
        const message = error?.data?.message || 'Erro ao excluir cliente.';
        toast({ title: message, variant: 'destructive' });
        setConfirmDeleteId(null);
      }
    });
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1 className="page-title">Clientes</h1>
        
        <div className="page-actions">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar cliente..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="shrink-0"><Plus className="w-4 h-4 mr-2" /> Novo Cliente</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Cadastrar Novo Cliente</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Nome Completo</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="phone" render={({ field }) => (
                      <FormItem><FormLabel>Telefone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="whatsapp" render={({ field }) => (
                      <FormItem><FormLabel>WhatsApp</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>E-mail</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="address" render={({ field }) => (
                    <FormItem><FormLabel>Endereço</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem><FormLabel>Observações</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />

                  <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-4">
                    <h3 className="text-sm font-semibold text-foreground">Cadastrar veículo junto (opcional)</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="vehicleBrand" render={({ field }) => (
                        <FormItem><FormLabel>Marca</FormLabel><FormControl><Input placeholder="Ex: VW" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="vehicleModel" render={({ field }) => (
                        <FormItem><FormLabel>Modelo</FormLabel><FormControl><Input placeholder="Ex: Polo" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <FormField control={form.control} name="vehicleYear" render={({ field }) => (
                        <FormItem><FormLabel>Ano</FormLabel><FormControl><Input type="number" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="vehiclePlate" render={({ field }) => (
                        <FormItem><FormLabel>Placa</FormLabel><FormControl><Input placeholder="ABC-1234" {...field} className="uppercase" /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="vehicleColor" render={({ field }) => (
                        <FormItem><FormLabel>Cor</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="vehicleFuel" render={({ field }) => (
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
                    <FormField control={form.control} name="vehicleNotes" render={({ field }) => (
                      <FormItem><FormLabel>Observações do veículo</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                    <Button type="submit" disabled={createMutation.isPending || createVehicleMutation.isPending}>
                      {(createMutation.isPending || createVehicleMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Salvar Cliente
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-border">
        <div className="overflow-hidden rounded-3xl border border-border bg-secondary/10">
          <div className="hidden md:grid grid-cols-12 gap-4 p-4 text-sm font-medium text-muted-foreground border-b border-border">
            <div className="col-span-5">Cliente</div>
            <div className="col-span-2">Contato</div>
            <div className="col-span-2 text-right">Valor Gasto</div>
            <div className="col-span-2 text-right hidden lg:block">Última Visita</div>
            <div className="col-span-1"></div>
          </div>
          
          <div className="space-y-4 p-4">
            {isLoading ? (
              <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
            ) : data?.data.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">Nenhum cliente encontrado.</div>
            ) : (
              data?.data.map((customer) => (
                <div key={customer.id} className="rounded-3xl border border-border bg-background/70 p-4 shadow-sm transition hover:bg-secondary/20">
                  <div className="grid gap-4 md:grid-cols-12 md:items-center">
                    <div className="md:col-span-5 flex items-center gap-3 min-w-0 cursor-pointer" onClick={() => setLocation(`/clientes/${customer.id}`)}>
                      <Avatar className="h-11 w-11 border border-border shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {customer.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium truncate text-foreground group-hover:text-primary transition-colors">
                          {customer.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{customer.totalServices} serviços realizados</p>
                      </div>
                    </div>
                    <div className="md:col-span-2 flex items-center gap-2 text-sm text-muted-foreground">
                      {(customer.whatsapp || customer.phone) ? (
                        <>
                          <Phone className="w-3 h-3 shrink-0" />
                          <span className="truncate">{customer.whatsapp || customer.phone}</span>
                        </>
                      ) : '-'}
                    </div>
                    <div className="md:col-span-2 text-right font-medium text-foreground">
                      {formatCurrency(customer.totalSpent || 0)}
                    </div>
                    <div className="md:col-span-2 hidden lg:block text-right text-sm text-muted-foreground">
                      {customer.lastServiceDate ? formatDate(customer.lastServiceDate) : '-'}
                    </div>
                    <div className="md:col-span-1 flex justify-end items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setConfirmDeleteId(customer.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setLocation(`/clientes/${customer.id}`)}
                      >
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </Button>
                    </div>
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

      <ConfirmDeleteDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => { if (!open) setConfirmDeleteId(null); }}
        onConfirm={handleDelete}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
