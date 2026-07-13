import { useState } from 'react';
import { 
  useListInventoryMovements, useCreateInventoryMovement, getListInventoryMovementsQueryKey,
  useListProducts, getListProductsQueryKey
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, ArrowDownRight, ArrowUpRight, RefreshCcw, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

const movementSchema = z.object({
  productId: z.coerce.number().min(1, 'Produto obrigatório'),
  movementType: z.enum(['entrada', 'saida', 'ajuste']),
  quantity: z.coerce.number().min(0.01, 'Quantidade deve ser maior que zero'),
  reason: z.string().optional()
});

type MovementForm = z.infer<typeof movementSchema>;

export default function Inventario() {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string>('todos');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useListInventoryMovements({ 
    page, 
    limit: 20,
    movementType: typeFilter !== 'todos' ? (typeFilter as any) : undefined
  });

  const { data: productsData } = useListProducts({ limit: 100 });

  const createMutation = useCreateInventoryMovement();

  const form = useForm<MovementForm>({
    resolver: zodResolver(movementSchema),
    defaultValues: {
      productId: 0, movementType: 'entrada', quantity: 1, reason: ''
    }
  });

  const onSubmit = (values: MovementForm) => {
    createMutation.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInventoryMovementsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        toast({ title: 'Movimentação registrada com sucesso!' });
        setIsCreateOpen(false);
        form.reset();
      },
      onError: () => {
        toast({ title: 'Erro ao registrar movimentação', variant: 'destructive' });
      }
    });
  };

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'entrada': return <ArrowDownRight className="w-4 h-4 text-emerald-500" />;
      case 'saida': return <ArrowUpRight className="w-4 h-4 text-red-500" />;
      case 'ajuste': return <RefreshCcw className="w-4 h-4 text-amber-500" />;
      default: return null;
    }
  };

  const getMovementBadge = (type: string) => {
    switch (type) {
      case 'entrada': return <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-none">Entrada</Badge>;
      case 'saida': return <Badge className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border-none">Saída</Badge>;
      case 'ajuste': return <Badge className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-none">Ajuste</Badge>;
      default: return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1 className="page-title">Inventário</h1>
        
        <div className="page-actions gap-3">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas movimentações</SelectItem>
              <SelectItem value="entrada">Entradas</SelectItem>
              <SelectItem value="saida">Saídas</SelectItem>
              <SelectItem value="ajuste">Ajustes</SelectItem>
            </SelectContent>
          </Select>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="shrink-0"><Plus className="w-4 h-4 mr-2" /> Nova Movimentação</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Movimentação</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                  <FormField control={form.control} name="productId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Produto</FormLabel>
                      <Select onValueChange={(v) => field.onChange(parseInt(v))} value={field.value ? String(field.value) : undefined}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione um produto" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {productsData?.data.map(p => (
                            <SelectItem key={p.id} value={String(p.id)}>{p.name} (Estoque: {p.stock})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="movementType" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="entrada">Entrada</SelectItem>
                            <SelectItem value="saida">Saída</SelectItem>
                            <SelectItem value="ajuste">Ajuste de Estoque</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="quantity" render={({ field }) => (
                      <FormItem><FormLabel>Quantidade</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="reason" render={({ field }) => (
                    <FormItem><FormLabel>Motivo / Observação</FormLabel><FormControl><Input placeholder="Ex: Compra, Perda, Ajuste..." {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                    <Button type="submit" disabled={createMutation.isPending}>Registrar</Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-border">
        <div className="rounded-md overflow-hidden">
          <div className="bg-muted/50 hidden md:grid md:grid-cols-12 gap-4 p-4 text-sm font-medium text-muted-foreground border-b border-border">
            <div className="col-span-2">Data/Hora</div>
            <div className="col-span-4">Produto</div>
            <div className="col-span-2 text-center">Tipo</div>
            <div className="col-span-2 text-right">Quantidade</div>
            <div className="col-span-2">Motivo</div>
          </div>
          
          <div className="divide-y divide-border">
            {isLoading ? (
              <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
            ) : data?.data.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Nenhuma movimentação encontrada.</div>
            ) : (
              data?.data.map((movement) => (
                <div key={movement.id} className="flex md:grid md:grid-cols-12 gap-4 p-4 flex-col md:items-center hover:bg-secondary/30 transition-colors">
                  <div className="text-sm text-muted-foreground md:col-span-2 flex justify-between items-center md:block">
                    <span className="md:hidden font-medium text-foreground">Data/Hora</span>
                    <span className="truncate">{formatDateTime(movement.createdAt)}</span>
                  </div>
                  <div className="font-medium text-foreground md:col-span-4">
                    {movement.product?.name || 'Produto Excluído'}
                  </div>
                  <div className="flex justify-between items-center md:col-span-2 md:justify-center md:gap-2">
                    <span className="md:hidden font-medium text-foreground">Tipo</span>
                    <div className="flex items-center gap-2">
                      {getMovementIcon(movement.movementType)}
                      {getMovementBadge(movement.movementType)}
                    </div>
                  </div>
                  <div className="font-bold flex justify-between items-center md:col-span-2 md:justify-end md:gap-1">
                    <span className="md:hidden font-medium text-foreground">Qtd</span>
                    <span className={`flex items-center gap-1 ${
                      movement.movementType === 'entrada' ? 'text-emerald-500' :
                      movement.movementType === 'saida' ? 'text-red-500' : 'text-amber-500'
                    }`}>
                      {movement.movementType === 'saida' ? '-' : '+'}{movement.quantity}
                      <span className="text-xs text-muted-foreground font-normal">{movement.product?.unit}</span>
                    </span>
                  </div>
                  <div className="hidden md:block md:col-span-2 text-sm text-muted-foreground truncate">
                    {movement.reason || (movement.appointmentId ? `OS #${movement.appointmentId}` : '-')}
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