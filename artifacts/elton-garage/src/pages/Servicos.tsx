import { useState } from 'react';
import { 
  useListServices, useCreateService, useDeleteService, getListServicesQueryKey 
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { Search, Plus, Wrench, Loader2, Clock, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';
import { Badge } from '@/components/ui/badge';

const serviceSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  description: z.string().optional(),
  price: z.coerce.number().min(0, 'Preço inválido'),
  estimatedDuration: z.coerce.number().min(0).optional(),
  category: z.string().optional(),
  vehicleType: z.enum(['todos', 'hatch', 'sedan', 'suv', 'pickup', 'van', 'moto', 'caminhao']).optional().default('todos'),
  active: z.boolean().default(true)
});

type ServiceForm = z.infer<typeof serviceSchema>;

export default function Servicos() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useListServices({ 
    page, 
    limit: 20, 
    search: debouncedSearch || undefined
  });

  const createMutation = useCreateService();
  const deleteMutation = useDeleteService();

  const form = useForm<ServiceForm>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: '', description: '', price: 0, estimatedDuration: 60, category: 'Lavagem', vehicleType: 'todos', active: true
    }
  });

  const onSubmit = (values: ServiceForm) => {
    createMutation.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListServicesQueryKey() });
        toast({ title: 'Serviço cadastrado com sucesso!' });
        setIsCreateOpen(false);
        form.reset();
      },
      onError: () => {
        toast({ title: 'Erro ao cadastrar serviço', variant: 'destructive' });
      }
    });
  };

  const handleDelete = () => {
    if (confirmDeleteId == null) return;
    deleteMutation.mutate({ id: confirmDeleteId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListServicesQueryKey() });
        toast({ title: 'Registro excluído com sucesso.' });
        setConfirmDeleteId(null);
      },
      onError: (error: any) => {
        const message = error?.data?.message || 'Erro ao excluir serviço.';
        toast({ title: message, variant: 'destructive' });
        setConfirmDeleteId(null);
      }
    });
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return '-';
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Catálogo de Serviços</h1>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar serviço..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="shrink-0"><Plus className="w-4 h-4 mr-2" /> Novo Serviço</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Cadastrar Novo Serviço</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Nome do Serviço</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="price" render={({ field }) => (
                      <FormItem><FormLabel>Preço (R$)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="estimatedDuration" render={({ field }) => (
                      <FormItem><FormLabel>Duração Estimada (min)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="category" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoria</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="Lavagem">Lavagem</SelectItem>
                            <SelectItem value="Estética">Estética</SelectItem>
                            <SelectItem value="Polimento">Polimento</SelectItem>
                            <SelectItem value="Higienização">Higienização</SelectItem>
                            <SelectItem value="Outros">Outros</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="vehicleType" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Veículo</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="todos">Todos</SelectItem>
                            <SelectItem value="hatch">Hatch</SelectItem>
                            <SelectItem value="sedan">Sedan</SelectItem>
                            <SelectItem value="suv">SUV</SelectItem>
                            <SelectItem value="pickup">Pickup</SelectItem>
                            <SelectItem value="van">Van</SelectItem>
                            <SelectItem value="moto">Moto</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem><FormLabel>Descrição</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="active" render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Serviço Ativo</FormLabel>
                        <div className="text-sm text-muted-foreground">Ocultar inativa o serviço para novos agendamentos</div>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )} />
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                    <Button type="submit" disabled={createMutation.isPending}>Salvar Serviço</Button>
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
            Nenhum serviço encontrado.
          </div>
        ) : (
          data?.data.map((service) => (
            <Card key={service.id} className={`border-border transition-colors group ${!service.active ? 'opacity-60 grayscale-[0.5]' : 'hover:border-primary/50'}`}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="bg-primary/10 p-2.5 rounded-lg text-primary">
                    <Wrench className="w-6 h-6" />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xl font-bold text-primary">{formatCurrency(service.price)}</span>
                    <Badge variant={service.active ? "outline" : "secondary"} className={service.active ? "bg-emerald-500/10 text-emerald-500 border-none" : ""}>
                      {service.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </div>
                
                <h3 className="font-bold text-lg mb-1 text-foreground">{service.name}</h3>
                {service.description && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2 min-h-[40px]">{service.description}</p>
                )}
                
                <div className="grid grid-cols-3 gap-2 text-xs pt-4 border-t border-border mt-4">
                  <div className="flex flex-col gap-1 text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Duração</span>
                    <span className="font-medium text-foreground">{formatDuration(service.estimatedDuration)}</span>
                  </div>
                  <div className="flex flex-col gap-1 text-muted-foreground">
                    <span>Categoria</span>
                    <span className="font-medium text-foreground">{service.category || '-'}</span>
                  </div>
                  <div className="flex flex-col gap-1 text-muted-foreground">
                    <span>Veículo</span>
                    <span className="font-medium text-foreground capitalize">{service.vehicleType}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 px-2"
                    onClick={() => setConfirmDeleteId(service.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <ConfirmDeleteDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => { if (!open) setConfirmDeleteId(null); }}
        onConfirm={handleDelete}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
