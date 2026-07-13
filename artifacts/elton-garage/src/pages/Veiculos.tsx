import { useState } from 'react';
import { useListVehicles, useCreateVehicle, useUpdateVehicle, useDeleteVehicle, getListVehiclesQueryKey, useListCustomers, getListCustomersQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, Car, Loader2, Edit, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';
import { Link } from 'wouter';

const vehicleSchema = z.object({
  customerId: z.coerce.number().min(1, 'Cliente obrigatório'),
  brand: z.string().min(1, 'Marca obrigatória'),
  model: z.string().min(1, 'Modelo obrigatório'),
  year: z.coerce.number().optional(),
  plate: z.string().optional(),
  color: z.string().optional(),
  fuel: z.enum(['gasolina', 'etanol', 'flex', 'diesel', 'gnv', 'eletrico', 'hibrido']).optional(),
  mileage: z.coerce.number().optional(),
  notes: z.string().optional()
});

type VehicleForm = z.infer<typeof vehicleSchema>;

export default function Veiculos() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useListVehicles({ 
    page, 
    limit: 20, 
    search: debouncedSearch || undefined
  });

  const { data: customersData } = useListCustomers({ limit: 100 });

  const createMutation = useCreateVehicle();
  const deleteMutation = useDeleteVehicle();

  const form = useForm<VehicleForm>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      customerId: 0, brand: '', model: '', plate: '', color: '', fuel: undefined, notes: ''
    }
  });

  const onSubmit = (values: VehicleForm) => {
    createMutation.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListVehiclesQueryKey() });
        toast({ title: 'Veículo cadastrado com sucesso!' });
        setIsCreateOpen(false);
        form.reset();
      },
      onError: () => {
        toast({ title: 'Erro ao cadastrar veículo', variant: 'destructive' });
      }
    });
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1 className="page-title">Veículos</h1>
        
        <div className="page-actions">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar veículo ou placa..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="shrink-0"><Plus className="w-4 h-4 mr-2" /> Novo Veículo</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Cadastrar Novo Veículo</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                  <FormField control={form.control} name="customerId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cliente</FormLabel>
                      <Select onValueChange={(v) => field.onChange(parseInt(v))} value={field.value ? String(field.value) : undefined}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {customersData?.data.map(c => (
                            <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="brand" render={({ field }) => (
                      <FormItem><FormLabel>Marca</FormLabel><FormControl><Input placeholder="Ex: VW" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="model" render={({ field }) => (
                      <FormItem><FormLabel>Modelo</FormLabel><FormControl><Input placeholder="Ex: Polo" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <FormField control={form.control} name="year" render={({ field }) => (
                      <FormItem><FormLabel>Ano</FormLabel><FormControl><Input type="number" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="plate" render={({ field }) => (
                      <FormItem><FormLabel>Placa</FormLabel><FormControl><Input placeholder="ABC-1234" {...field} className="uppercase" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="color" render={({ field }) => (
                      <FormItem><FormLabel>Cor</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="fuel" render={({ field }) => (
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
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Salvar Veículo
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : data?.data.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed border-border rounded-lg">
            Nenhum veículo encontrado.
          </div>
        ) : (
          data?.data.map((vehicle) => (
            <Card key={vehicle.id} className="border-border hover:border-primary/50 transition-colors overflow-hidden group">
              <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2.5 rounded-lg text-primary">
                      <Car className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg leading-tight">{vehicle.brand} {vehicle.model}</h3>
                      <Link href={`/clientes/${vehicle.customerId}`} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                        {vehicle.customerName || 'Cliente'}
                      </Link>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => {
                      deleteMutation.mutate({ id: vehicle.id }, {
                        onSuccess: () => {
                          queryClient.invalidateQueries({ queryKey: getListVehiclesQueryKey() });
                          queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
                          toast({ title: 'Veículo excluído com sucesso.' });
                        },
                        onError: (error: any) => {
                          toast({ title: error?.data?.message || 'Erro ao excluir veículo.', variant: 'destructive' });
                        }
                      });
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm mt-4">
                  {vehicle.plate && (
                    <div className="flex flex-col">
                      <span className="text-muted-foreground text-xs">Placa</span>
                      <span className="font-mono font-medium">{vehicle.plate.toUpperCase()}</span>
                    </div>
                  )}
                  {vehicle.year && (
                    <div className="flex flex-col">
                      <span className="text-muted-foreground text-xs">Ano</span>
                      <span className="font-medium">{vehicle.year}</span>
                    </div>
                  )}
                  {vehicle.color && (
                    <div className="flex flex-col">
                      <span className="text-muted-foreground text-xs">Cor</span>
                      <span className="font-medium capitalize">{vehicle.color}</span>
                    </div>
                  )}
                  {vehicle.fuel && (
                    <div className="flex flex-col">
                      <span className="text-muted-foreground text-xs">Combustível</span>
                      <span className="font-medium capitalize">{vehicle.fuel}</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
      
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