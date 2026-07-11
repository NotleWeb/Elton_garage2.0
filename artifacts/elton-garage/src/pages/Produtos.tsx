import { useState } from 'react';
import { 
  useListProducts, useCreateProduct, useDeleteProduct, getListProductsQueryKey 
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { Search, Plus, Package, Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';
import { Badge } from '@/components/ui/badge';

const productSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  brand: z.string().optional(),
  supplier: z.string().optional(),
  purchasePrice: z.coerce.number().min(0).optional(),
  salePrice: z.coerce.number().min(0).optional(),
  stock: z.coerce.number().min(0),
  minimumStock: z.coerce.number().min(0),
  unit: z.string().default('un')
});

type ProductForm = z.infer<typeof productSchema>;

export default function Produtos() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [showLowStock, setShowLowStock] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useListProducts({ 
    page, 
    limit: 50, 
    search: debouncedSearch || undefined,
    lowStock: showLowStock ? true : undefined
  });

  const createMutation = useCreateProduct();
  const deleteMutation = useDeleteProduct();

  const form = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '', brand: '', supplier: '', purchasePrice: 0, salePrice: 0, stock: 0, minimumStock: 5, unit: 'un'
    }
  });

  const onSubmit = (values: ProductForm) => {
    createMutation.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        toast({ title: 'Produto cadastrado com sucesso!' });
        setIsCreateOpen(false);
        form.reset();
      },
      onError: () => {
        toast({ title: 'Erro ao cadastrar produto', variant: 'destructive' });
      }
    });
  };

  const handleDelete = () => {
    if (confirmDeleteId == null) return;
    deleteMutation.mutate({ id: confirmDeleteId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        toast({ title: 'Registro excluído com sucesso.' });
        setConfirmDeleteId(null);
      },
      onError: (error: any) => {
        const message = error?.data?.message || 'Erro ao excluir produto.';
        toast({ title: message, variant: 'destructive' });
        setConfirmDeleteId(null);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Produtos & Estoque</h1>
        
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center space-x-2 bg-secondary/50 px-3 py-1.5 rounded-md border border-border">
            <Switch id="low-stock" checked={showLowStock} onCheckedChange={setShowLowStock} />
            <label htmlFor="low-stock" className="text-sm font-medium cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
              Apenas estoque baixo
            </label>
          </div>
          
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar produto..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="shrink-0"><Plus className="w-4 h-4 mr-2" /> Novo Produto</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Cadastrar Novo Produto</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Nome do Produto</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="brand" render={({ field }) => (
                      <FormItem><FormLabel>Marca</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="supplier" render={({ field }) => (
                      <FormItem><FormLabel>Fornecedor</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <FormField control={form.control} name="stock" render={({ field }) => (
                      <FormItem><FormLabel>Estoque Atual</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="minimumStock" render={({ field }) => (
                      <FormItem><FormLabel>Estoque Mínimo</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="unit" render={({ field }) => (
                      <FormItem><FormLabel>Unidade</FormLabel><FormControl><Input placeholder="un, ml, L..." {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="purchasePrice" render={({ field }) => (
                      <FormItem><FormLabel>Preço de Custo (R$)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="salePrice" render={({ field }) => (
                      <FormItem><FormLabel>Preço de Venda (R$)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                    <Button type="submit" disabled={createMutation.isPending}>Salvar Produto</Button>
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
            <div className="col-span-4 md:col-span-3">Produto</div>
            <div className="col-span-3 hidden md:block">Marca/Fornecedor</div>
            <div className="col-span-3 text-right">Estoque</div>
            <div className="col-span-3 md:col-span-2 text-right">Preço Venda</div>
            <div className="col-span-2 md:col-span-1"></div>
          </div>
          
          <div className="space-y-4 p-4">
            {isLoading ? (
              <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
            ) : data?.data.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">Nenhum produto encontrado.</div>
            ) : (
              data?.data.map((product) => (
                <div key={product.id} className="rounded-3xl border border-border bg-background/70 p-4 shadow-sm transition hover:bg-secondary/20">
                  <div className="grid gap-4 md:grid-cols-12 md:items-center">
                    <div className="md:col-span-4 flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded ${product.isLowStock ? 'bg-red-500/10 text-red-500' : 'bg-secondary text-muted-foreground'}`}>
                        <Package className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{product.name}</p>
                        {product.isLowStock && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded inline-flex items-center gap-1 mt-1">
                            <AlertTriangle className="w-3 h-3" /> Estoque Baixo
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="md:col-span-3 hidden md:block">
                      <p className="text-sm truncate text-foreground">{product.brand || '-'}</p>
                      <p className="text-xs text-muted-foreground truncate">{product.supplier}</p>
                    </div>
                    <div className="md:col-span-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className={`font-bold ${product.isLowStock ? 'text-red-500' : 'text-foreground'}`}>
                          {product.stock}
                        </span>
                        <span className="text-muted-foreground text-xs">{product.unit}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">Min: {product.minimumStock}</p>
                    </div>
                    <div className="md:col-span-2 text-right font-medium">
                      {product.salePrice ? formatCurrency(product.salePrice) : '-'}
                    </div>
                    <div className="md:col-span-1 flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setConfirmDeleteId(product.id)}
                      >
                        <Trash2 className="w-4 h-4" />
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
